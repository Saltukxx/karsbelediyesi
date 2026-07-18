import { Suspense } from "react";
import { prisma } from "@kars/db";
import {
  betonUretimMalzeme,
  suCimentoOrani,
  toplamAgregaKg,
  toplamKarisimKg,
  yogunlukKontrolu,
  betonGuncelStok,
  betonStokDurumu,
} from "@kars/shared";
import {
  betonUretimOlustur,
  betonStokGiris,
  betonReceteGuncelle,
} from "@/lib/actions/beton";
import { cardCls, inputCls, btnPrimary } from "@/lib/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requirePageAccess } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function BetonPage({
  searchParams,
}: {
  searchParams: Promise<{ recipeId?: string; m3?: string; tab?: string }>;
}) {
  await requirePageAccess("/beton");
  const sp = await searchParams;
  const [recipes, productions, stocks] = await Promise.all([
    prisma.concreteRecipe.findMany({ where: { aktif: true }, orderBy: { sinif: "asc" } }),
    prisma.concreteProduction.findMany({
      orderBy: { tarih: "desc" },
      take: 50,
      include: { recipe: true },
    }),
    prisma.concreteStock.findMany({ orderBy: { malzeme: "asc" } }),
  ]);

  const selected =
    recipes.find((r) => r.id === sp.recipeId) ?? recipes[0] ?? null;
  const m3 = Number(sp.m3 ?? 1) || 1;

  const ihtiyac = selected
    ? {
        cimento: betonUretimMalzeme(m3, selected.cimentoKg),
        kum: betonUretimMalzeme(m3, selected.kumKg),
        m05: betonUretimMalzeme(m3, selected.micir05Kg),
        m512: betonUretimMalzeme(m3, selected.micir512Kg),
        m1219: betonUretimMalzeme(m3, selected.micir1219Kg),
        su: betonUretimMalzeme(m3, selected.suLt),
        katki: betonUretimMalzeme(m3, selected.katkiKg),
      }
    : null;

  const recipeMeta = selected
    ? (() => {
        const toplamAgrega = toplamAgregaKg(
          selected.kumKg,
          selected.micir05Kg,
          selected.micir512Kg,
          selected.micir1219Kg,
        );
        const toplam = toplamKarisimKg(
          selected.cimentoKg,
          selected.kumKg,
          selected.micir05Kg,
          selected.micir512Kg,
          selected.micir1219Kg,
          selected.suLt,
          selected.katkiKg,
        );
        return {
          wC: suCimentoOrani(selected.suLt, selected.cimentoKg),
          toplamAgrega,
          toplam,
          yogunluk: yogunlukKontrolu(toplam),
        };
      })()
    : null;

  const now = new Date();
  const ayBaslangic = new Date(now.getFullYear(), now.getMonth(), 1);
  const [uretimSum, ayUretim, tumUretim] = await Promise.all([
    prisma.concreteProduction.aggregate({
      _sum: {
        cimentoKg: true,
        kumKg: true,
        micir05Kg: true,
        micir512Kg: true,
        micir1219Kg: true,
        suLt: true,
        katkiKg: true,
      },
    }),
    prisma.concreteProduction.aggregate({
      where: { tarih: { gte: ayBaslangic } },
      _sum: { hedefM3: true },
      _count: true,
    }),
    prisma.concreteProduction.aggregate({
      _sum: { hedefM3: true },
      _count: true,
    }),
  ]);
  const sum = uretimSum._sum;
  const cikisMap: Record<string, number> = {
    Cimento: sum.cimentoKg ?? 0,
    Kum: sum.kumKg ?? 0,
    "Micir 0-5mm": sum.micir05Kg ?? 0,
    "Micir 5-12mm": sum.micir512Kg ?? 0,
    "Micir 12-19mm": sum.micir1219Kg ?? 0,
    Su: sum.suLt ?? 0,
    Katki: sum.katkiKg ?? 0,
  };

  const today = new Date().toISOString().slice(0, 10);
  const ayM3 = ayUretim._sum.hedefM3 ?? 0;
  const toplamM3 = tumUretim._sum.hedefM3 ?? 0;
  const kritikStokSayisi = stocks.filter((s) => {
    const cikis = cikisMap[s.malzeme] ?? 0;
    const stok = betonGuncelStok(s.baslangicStok, s.toplamGiris, cikis);
    return betonStokDurumu(stok, s.kritikSeviye) === "KRITIK";
  }).length;

  return (
    <div className="space-y-6">
      <div>
        <PageHeader title="Beton Reçeteleri" />
        <p className="text-sm text-kb-muted">
          Excel formülleri: ihtiyaç = reçete × m³ · w/c · yoğunluk · stok = başlangıç + giriş − üretim.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={`${cardCls} p-4`}>
          <div className="text-xs text-kb-muted">Reçete sayısı</div>
          <div className="text-xl font-bold">{recipes.length}</div>
        </div>
        <div className={`${cardCls} p-4`}>
          <div className="text-xs text-kb-muted">Bu ay üretim (m³)</div>
          <div className="text-xl font-bold">{ayM3.toLocaleString("tr-TR")}</div>
        </div>
        <div className={`${cardCls} p-4`}>
          <div className="text-xs text-kb-muted">Toplam üretim (m³)</div>
          <div className="text-xl font-bold">{toplamM3.toLocaleString("tr-TR")}</div>
        </div>
        <div className={`${cardCls} p-4`}>
          <div className="text-xs text-kb-muted">Kritik stok</div>
          <div className="text-xl font-bold">{kritikStokSayisi}</div>
        </div>
      </div>

      <Suspense fallback={null}>
        <Tabs
          defaultTab="hesapla"
          tabs={[
            { id: "hesapla", label: "Hesapla" },
            { id: "uretim", label: "Üretim" },
            { id: "stok", label: "Stok" },
            { id: "receteler", label: "Reçeteler" },
          ]}
        />

        <TabPanel id="hesapla" defaultTab="hesapla">
          <section className={`${cardCls} p-4 space-y-3`}>
            <h2 className="text-base font-semibold text-kb-ink">m³ Hesaplayıcı</h2>
            <form className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs text-kb-muted block mb-1">Reçete</label>
                <select name="recipeId" defaultValue={selected?.id ?? ""} className={inputCls}>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>{r.sinif}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-kb-muted block mb-1">Hedef m³</label>
                <input name="m3" type="number" step="0.1" defaultValue={m3} className={inputCls} />
              </div>
              <button className={btnPrimary}>Hesapla</button>
            </form>
            {ihtiyac && recipeMeta && selected && (
              <>
                <div className="flex flex-wrap gap-4 text-sm text-kb-muted">
                  <span>w/c: <strong className="">{recipeMeta.wC.toFixed(3)}</strong></span>
                  <span>Toplam agrega: <strong className="">{recipeMeta.toplamAgrega} kg</strong></span>
                  <span>1 m³ karışım: <strong className="">{recipeMeta.toplam} kg</strong></span>
                  <span>Yoğunluk: <strong className="">{recipeMeta.yogunluk}</strong></span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-sm">
                  {(
                    [
                      ["Çimento", ihtiyac.cimento, "kg"],
                      ["Kum", ihtiyac.kum, "kg"],
                      ["0-5", ihtiyac.m05, "kg"],
                      ["5-12", ihtiyac.m512, "kg"],
                      ["12-19", ihtiyac.m1219, "kg"],
                      ["Su", ihtiyac.su, "lt"],
                      ["Katkı", ihtiyac.katki, "kg"],
                    ] as const
                  ).map(([label, val, birim]) => (
                    <div key={label} className="rounded-lg bg-[#eef2f6] p-3">
                      <div className="text-xs text-kb-muted">{label}</div>
                      <div className="font-semibold">
                        {val.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} {birim}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </TabPanel>

        <TabPanel id="uretim" defaultTab="hesapla">
          <form action={betonUretimOlustur} className={`${cardCls} p-4 grid md:grid-cols-4 gap-3 items-end`}>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Tarih *</label>
              <input name="tarih" type="date" required defaultValue={today} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Reçete *</label>
              <select name="recipeId" required className={inputCls}>
                <option value="">—</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>{r.sinif}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Hedef m³ *</label>
              <input name="hedefM3" type="number" step="0.01" required className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-kb-muted block mb-1">Not</label>
              <input name="notlar" className={inputCls} />
            </div>
            <button className={`${btnPrimary} md:col-span-4`}>+ Üretim Kaydet</button>
          </form>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-kb-ink">Son Üretimler</h2>
            <div className={`${cardCls} overflow-x-auto`}>
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="text-left text-xs text-kb-muted border-b bg-[#eef2f6]">
                    <th className="p-3">Tarih</th>
                    <th className="p-3">Sınıf</th>
                    <th className="p-3">m³</th>
                    <th className="p-3">Çimento</th>
                    <th className="p-3">Kum</th>
                    <th className="p-3">Su</th>
                  </tr>
                </thead>
                <tbody>
                  {productions.map((p) => (
                    <tr key={p.id} className="border-b border-kb-border/60">
                      <td className="p-3">{p.tarih.toLocaleDateString("tr-TR")}</td>
                      <td className="p-3">{p.recipe.sinif}</td>
                      <td className="p-3">{p.hedefM3}</td>
                      <td className="p-3">{p.cimentoKg}</td>
                      <td className="p-3">{p.kumKg}</td>
                      <td className="p-3">{p.suLt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </TabPanel>

        <TabPanel id="stok" defaultTab="hesapla">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-kb-ink">Malzeme Stok</h2>
            <form action={betonStokGiris} className={`${cardCls} p-4 flex flex-wrap gap-3 items-end`}>
              <div>
                <label className="text-xs text-kb-muted block mb-1">Malzeme</label>
                <select name="malzeme" required className={inputCls}>
                  {stocks.map((s) => (
                    <option key={s.id} value={s.malzeme}>{s.malzeme}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-kb-muted block mb-1">Giriş miktarı</label>
                <input name="miktar" type="number" step="0.01" required className={inputCls} />
              </div>
              <button className={btnPrimary}>+ Stok Girişi</button>
            </form>
            <div className={`${cardCls} overflow-x-auto`}>
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="text-left text-xs text-kb-muted border-b bg-[#eef2f6]">
                    <th className="p-3">Malzeme</th>
                    <th className="p-3">Başlangıç</th>
                    <th className="p-3">Giriş</th>
                    <th className="p-3">Üretim çıkışı</th>
                    <th className="p-3">Mevcut</th>
                    <th className="p-3">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((s) => {
                    const cikis = cikisMap[s.malzeme] ?? 0;
                    const stok = betonGuncelStok(s.baslangicStok, s.toplamGiris, cikis);
                    const durum = betonStokDurumu(stok, s.kritikSeviye);
                    return (
                      <tr key={s.id} className="border-b border-kb-border/60">
                        <td className="p-3">{s.malzeme}</td>
                        <td className="p-3">{s.baslangicStok}</td>
                        <td className="p-3">{s.toplamGiris}</td>
                        <td className="p-3">{cikis.toLocaleString("tr-TR")}</td>
                        <td className="p-3 font-medium">{stok.toLocaleString("tr-TR")}</td>
                        <td className="p-3"><StatusBadge label={durum} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </TabPanel>

        <TabPanel id="receteler" defaultTab="hesapla">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-kb-ink">Reçeteler (1 m³)</h2>
            <div className="space-y-3">
              {recipes.map((r) => (
                <form key={r.id} action={betonReceteGuncelle} className={`${cardCls} p-4 grid md:grid-cols-4 lg:grid-cols-9 gap-2 items-end`}>
                  <input type="hidden" name="id" value={r.id} />
                  <div className="font-semibold self-center">{r.sinif}</div>
                  {(
                    [
                      ["cimentoKg", "Çimento", r.cimentoKg],
                      ["kumKg", "Kum", r.kumKg],
                      ["micir05Kg", "0-5", r.micir05Kg],
                      ["micir512Kg", "5-12", r.micir512Kg],
                      ["micir1219Kg", "12-19", r.micir1219Kg],
                      ["suLt", "Su", r.suLt],
                      ["katkiKg", "Katkı", r.katkiKg],
                    ] as const
                  ).map(([name, label, val]) => (
                    <div key={name}>
                      <label className="text-xs text-kb-muted block mb-1">{label}</label>
                      <input name={name} type="number" step="0.01" defaultValue={val} className={inputCls} />
                    </div>
                  ))}
                  <button className={btnPrimary}>Kaydet</button>
                </form>
              ))}
            </div>
          </section>
        </TabPanel>
      </Suspense>
    </div>
  );
}
