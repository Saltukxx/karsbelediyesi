import { Suspense } from "react";
import { prisma } from "@kars/db";
import { mevcutStok, stokDurumu, AY_ADLARI, aylikNetHareket, ayAdiFromDate } from "@kars/shared";
import { malzemeOlustur, stokHareketOlustur } from "@/lib/actions/materials";
import { cardCls, inputCls, btnPrimary } from "@/lib/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requirePageAccess } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function MalzemeDepoPage({
  searchParams,
}: {
  searchParams: Promise<{ ay?: string; kategori?: string; tab?: string }>;
}) {
  await requirePageAccess("/malzeme-depo");
  const sp = await searchParams;
  const ayAdi = sp.ay || AY_ADLARI[new Date().getMonth()];
  const ayIndex = AY_ADLARI.indexOf(ayAdi as (typeof AY_ADLARI)[number]);

  const taskSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [materials, movements, mudurlukler, allMovements, gorevler] = await Promise.all([
    prisma.material.findMany({ where: { aktif: true }, orderBy: { kod: "asc" } }),
    prisma.materialMovement.findMany({
      orderBy: { tarih: "desc" },
      take: 100,
      include: { material: true, department: true },
    }),
    prisma.department.findMany({ where: { aktif: true }, orderBy: { name: "asc" } }),
    prisma.materialMovement.findMany({
      include: { material: true },
    }),
    prisma.vehicleTask.findMany({
      where: { talepTarihi: { gte: taskSince } },
      orderBy: { talepTarihi: "desc" },
      take: 100,
      select: {
        id: true,
        gorevNo: true,
        gorevTanimi: true,
        vehicle: { select: { plaka: true } },
      },
    }),
  ]);

  const sums = await prisma.materialMovement.groupBy({
    by: ["materialId", "tip"],
    _sum: { miktar: true },
  });

  const stokDurumlari = materials.map((m) => {
    const giris = Number(
      sums.find((s) => s.materialId === m.id && s.tip === "GIRIS")?._sum.miktar ?? 0,
    );
    const cikis = Number(
      sums.find((s) => s.materialId === m.id && s.tip === "CIKIS")?._sum.miktar ?? 0,
    );
    const stok = mevcutStok(giris, cikis);
    return { m, giris, cikis, stok, durum: stokDurumu(stok, m.kritikStok) };
  });

  const kategoriler = [...new Set(materials.map((m) => m.kategori))].sort();
  const aylikRapor = materials
    .filter((m) => !sp.kategori || m.kategori === sp.kategori)
    .map((m) => {
      const rows = allMovements.filter((h) => {
        if (h.materialId !== m.id) return false;
        if (ayIndex < 0) return true;
        return ayAdiFromDate(h.tarih) === ayAdi;
      });
      const giris = rows.filter((r) => r.tip === "GIRIS").reduce((s, r) => s + Number(r.miktar), 0);
      const cikis = rows.filter((r) => r.tip === "CIKIS").reduce((s, r) => s + Number(r.miktar), 0);
      const net = aylikNetHareket(giris, cikis);
      const guncel = stokDurumlari.find((s) => s.m.id === m.id)?.stok ?? 0;
      return { m, giris, cikis, net, guncel };
    });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <PageHeader
          title="Malzeme / Depo Envanter"
          description="Stok = Giriş − Çıkış · Durum: ≤kritik KRİTİK, ≤kritik×1.3 DİKKAT."
        />
      </div>

      <Suspense fallback={null}>
        <Tabs
          defaultTab="stok"
          tabs={[
            { id: "stok", label: "Stok" },
            { id: "hareket", label: "Hareket" },
            { id: "aylik", label: "Aylık" },
          ]}
        />

        <TabPanel id="stok" defaultTab="stok">
          <form action={malzemeOlustur} className={`${cardCls} p-4 grid md:grid-cols-4 gap-3 items-end`}>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Kod *</label>
              <input name="kod" required placeholder="MLZ-0003" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Ad *</label>
              <input name="ad" required className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Kategori *</label>
              <input name="kategori" required defaultValue="İnşaat Malzemesi" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Birim *</label>
              <input name="birim" required defaultValue="Adet" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Depo Lokasyonu</label>
              <input name="depoLokasyon" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Kritik Stok</label>
              <input name="kritikStok" type="number" step="0.01" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Birim Fiyat</label>
              <input name="birimFiyat" type="number" step="0.01" className={inputCls} />
            </div>
            <button className={btnPrimary}>+ Malzeme</button>
          </form>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-kb-ink">Stok Durumu</h2>
            <div className={`${cardCls} overflow-x-auto`}>
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="text-left text-xs text-kb-muted border-b bg-[#eef2f6]">
                    <th className="p-3">Kod</th>
                    <th className="p-3">Ad</th>
                    <th className="p-3">Giriş</th>
                    <th className="p-3">Çıkış</th>
                    <th className="p-3">Mevcut</th>
                    <th className="p-3">Kritik</th>
                    <th className="p-3">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {stokDurumlari.map(({ m, giris, cikis, stok, durum }) => (
                    <tr key={m.id} className="border-b border-kb-border/60">
                      <td className="p-3 font-mono">{m.kod}</td>
                      <td className="p-3">{m.ad}</td>
                      <td className="p-3">{giris}</td>
                      <td className="p-3">{cikis}</td>
                      <td className="p-3 font-medium">{stok}</td>
                      <td className="p-3">{m.kritikStok}</td>
                      <td className="p-3"><StatusBadge label={durum} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </TabPanel>

        <TabPanel id="hareket" defaultTab="stok">
          <form action={stokHareketOlustur} className={`${cardCls} p-4 grid md:grid-cols-4 lg:grid-cols-6 gap-3 items-end`}>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Tarih *</label>
              <input name="tarih" type="date" required defaultValue={today} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Malzeme *</label>
              <select name="materialId" required className={inputCls}>
                <option value="">—</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>{m.kod} — {m.ad}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Hareket *</label>
              <select name="tip" className={inputCls}>
                <option value="GIRIS">Giriş</option>
                <option value="CIKIS">Çıkış</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Miktar *</label>
              <input name="miktar" type="number" step="0.001" required className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Müdürlük</label>
              <select name="departmentId" className={inputCls}>
                <option value="">—</option>
                {mudurlukler.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Belge No</label>
              <input name="belgeNo" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">
                Görev (çıkışta maliyet takibi)
              </label>
              <select name="vehicleTaskId" className={inputCls}>
                <option value="">— Bağlanmadı —</option>
                {gorevler.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.gorevNo} · {g.vehicle.plaka}
                    {g.gorevTanimi ? ` — ${g.gorevTanimi.slice(0, 40)}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <button className={`${btnPrimary} lg:col-span-6`}>+ Hareket Kaydet</button>
          </form>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-kb-ink">Son Hareketler</h2>
            <div className={`${cardCls} overflow-x-auto`}>
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="text-left text-xs text-kb-muted border-b bg-[#eef2f6]">
                    <th className="p-3">Tarih</th>
                    <th className="p-3">Kod</th>
                    <th className="p-3">Tip</th>
                    <th className="p-3">Miktar</th>
                    <th className="p-3">Müdürlük</th>
                    <th className="p-3">Belge</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((h) => (
                    <tr key={h.id} className="border-b border-kb-border/60">
                      <td className="p-3">{h.tarih.toLocaleDateString("tr-TR")}</td>
                      <td className="p-3 font-mono">{h.material.kod}</td>
                      <td className="p-3">{h.tip}</td>
                      <td className="p-3">{Number(h.miktar)}</td>
                      <td className="p-3">{h.department?.shortName ?? "—"}</td>
                      <td className="p-3">{h.belgeNo ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </TabPanel>

        <TabPanel id="aylik" defaultTab="stok">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-kb-ink">Aylık Hareket Raporu — {ayAdi}</h2>
            <form className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs text-kb-muted block mb-1">Ay</label>
                <select name="ay" defaultValue={ayAdi} className={inputCls}>
                  {AY_ADLARI.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-kb-muted block mb-1">Kategori</label>
                <select name="kategori" defaultValue={sp.kategori ?? ""} className={inputCls}>
                  <option value="">Tümü</option>
                  {kategoriler.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
              <button className={btnPrimary}>Filtrele</button>
            </form>
            <div className={`${cardCls} overflow-x-auto`}>
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="text-left text-xs text-kb-muted border-b bg-[#eef2f6]">
                    <th className="p-3">Kod</th>
                    <th className="p-3">Ad</th>
                    <th className="p-3">Birim</th>
                    <th className="p-3">Ay Giriş</th>
                    <th className="p-3">Ay Çıkış</th>
                    <th className="p-3">Net</th>
                    <th className="p-3">Güncel Stok</th>
                  </tr>
                </thead>
                <tbody>
                  {aylikRapor.map(({ m, giris, cikis, net, guncel }) => (
                    <tr key={m.id} className="border-b border-kb-border/60">
                      <td className="p-3 font-mono">{m.kod}</td>
                      <td className="p-3">{m.ad}</td>
                      <td className="p-3">{m.birim}</td>
                      <td className="p-3">{giris}</td>
                      <td className="p-3">{cikis}</td>
                      <td className="p-3 font-medium">{net}</td>
                      <td className="p-3">{guncel}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#eef2f6] font-semibold">
                    <td className="p-3" colSpan={3}>TOPLAM</td>
                    <td className="p-3">{aylikRapor.reduce((s, r) => s + r.giris, 0)}</td>
                    <td className="p-3">{aylikRapor.reduce((s, r) => s + r.cikis, 0)}</td>
                    <td className="p-3">{aylikRapor.reduce((s, r) => s + r.net, 0)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </TabPanel>
      </Suspense>
    </div>
  );
}
