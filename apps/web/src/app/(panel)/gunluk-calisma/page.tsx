import { prisma } from "@kars/db";
import { CALISMA_TIPI_LABELS, YAKIT_TURU_LABELS } from "@kars/shared";
import { personelGunlukOlustur, aracGunlukOlustur } from "@/lib/actions/worklogs";
import { inputCls, btnPrimary, cardCls } from "@/lib/ui";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { departmentScope, requirePageAccess } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function GunlukCalismaPage({
  searchParams,
}: {
  searchParams: Promise<{ ay?: string; yil?: string }>;
}) {
  const session = await requirePageAccess("/gunluk-calisma");
  const dept = departmentScope(session);
  const sp = await searchParams;
  const now = new Date();
  const ay = Number(sp.ay) || now.getMonth() + 1;
  const yil = Number(sp.yil) || now.getFullYear();
  const bas = new Date(yil, ay - 1, 1);
  const bit = new Date(yil, ay, 0, 23, 59, 59);

  const [
    personelKayitlar,
    aracKayitlar,
    personeller,
    araclar,
    soforler,
    onaylayanlar,
    mudurlukler,
  ] = await Promise.all([
    prisma.personnelWorkLog.findMany({
      where: {
        tarih: { gte: bas, lte: bit },
        ...(dept.departmentId ? { personnel: { departmentId: dept.departmentId } } : {}),
      },
      orderBy: { tarih: "desc" },
      include: { personnel: true, gorevlendirilenBirim: true },
    }),
    prisma.vehicleWorkLog.findMany({
      where: {
        tarih: { gte: bas, lte: bit },
        ...(dept.departmentId ? { vehicle: { departmentId: dept.departmentId } } : {}),
      },
      orderBy: { tarih: "desc" },
      include: { vehicle: true, driver: true },
    }),
    prisma.personnel.findMany({
      where: { durum: "AKTIF", ...dept },
      orderBy: { adSoyad: "asc" },
    }),
    prisma.vehicle.findMany({
      where: { envanterDurumu: { not: "HURDAYA_AYRILDI" }, ...dept },
      orderBy: { plaka: "asc" },
    }),
    prisma.user.findMany({
      where: { role: { in: ["DRIVER", "FIELD_WORKER"] }, aktif: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: { in: ["APPROVER", "ADMIN", "DEPARTMENT_MANAGER"] }, aktif: true },
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({ where: { aktif: true }, orderBy: { name: "asc" } }),
  ]);

  const aracSaat = aracKayitlar.reduce((s, k) => s + k.calismaSaati, 0);
  const aracYakit = aracKayitlar.reduce((s, k) => s + Number(k.yakitLitre ?? 0), 0);
  const normalToplam = personelKayitlar.reduce((s, k) => s + k.normalSaat, 0);
  const mesaiToplam = personelKayitlar.reduce((s, k) => s + k.mesaiSaat, 0);
  const personelToplam = personelKayitlar.reduce((s, k) => s + k.toplamSaat, 0);
  const fazlaMesaiKayit = personelKayitlar.filter((k) => k.mesaiSaat > 0).length;

  const aracBazli = new Map<string, { plaka: string; ad: string; saat: number; yakit: number }>();
  for (const k of aracKayitlar) {
    const cur = aracBazli.get(k.vehicleId) ?? {
      plaka: k.vehicle.plaka,
      ad: k.vehicle.ad ?? "",
      saat: 0,
      yakit: 0,
    };
    cur.saat += k.calismaSaati;
    cur.yakit += Number(k.yakitLitre ?? 0);
    aracBazli.set(k.vehicleId, cur);
  }

  const personelBazli = new Map<string, { ad: string; normal: number; mesai: number }>();
  for (const k of personelKayitlar) {
    const cur = personelBazli.get(k.personnelId) ?? {
      ad: k.personnel.adSoyad,
      normal: 0,
      mesai: 0,
    };
    cur.normal += k.normalSaat;
    cur.mesai += k.mesaiSaat;
    personelBazli.set(k.personnelId, cur);
  }

  const today = now.toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <PageHeader title="Günlük Çalışma" />
          <p className="text-sm text-kb-muted">
            Personel + Araç günlük takip. Saatler Excel formülleriyle otomatik.
          </p>
        </div>
        <form className="flex gap-2 items-end">
          <div>
            <label className="text-xs text-kb-muted block mb-1">Ay</label>
            <input name="ay" type="number" min={1} max={12} defaultValue={ay} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Yıl</label>
            <input name="yil" type="number" defaultValue={yil} className={inputCls} />
          </div>
          <button className={btnPrimary}>Filtrele</button>
        </form>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Araç kaydı", aracKayitlar.length],
          ["Araç saati", aracSaat.toFixed(1)],
          ["Yakıt (Lt)", aracYakit.toLocaleString("tr-TR")],
          ["Personel kaydı", personelKayitlar.length],
          ["Normal saat", normalToplam.toFixed(1)],
          ["Mesai saat", mesaiToplam.toFixed(1)],
          ["Toplam personel saati", personelToplam.toFixed(1)],
          ["Fazla mesai kayıt", fazlaMesaiKayit],
        ].map(([label, val]) => (
          <div key={String(label)} className={`${cardCls} p-4`}>
            <div className="text-xs text-kb-muted">{label}</div>
            <div className="text-xl font-semibold mt-1">{val}</div>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-kb-ink">Personel Günlük Takip</h2>
        <form
          action={personelGunlukOlustur}
          className={`${cardCls} p-4 grid md:grid-cols-3 lg:grid-cols-5 gap-3 items-end`}
        >
          <div>
            <label className="text-xs text-kb-muted block mb-1">Tarih *</label>
            <input name="tarih" type="date" required defaultValue={today} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Personel *</label>
            <select name="personnelId" required className={inputCls}>
              <option value="">—</option>
              {personeller.map((p) => (
                <option key={p.id} value={p.id}>{p.adSoyad}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Giriş *</label>
            <input name="girisSaati" type="time" required defaultValue="08:00" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Çıkış *</label>
            <input name="cikisSaati" type="time" required defaultValue="17:00" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Çalışma Tipi</label>
            <select name="calismaTipi" className={inputCls}>
              {Object.entries(CALISMA_TIPI_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Yapılan İş</label>
            <input name="yapilanIs" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Görevlendirilen Birim</label>
            <select name="gorevlendirilenBirimId" className={inputCls}>
              <option value="">—</option>
              {mudurlukler.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Onaylayan</label>
            <select name="onaylayanId" className={inputCls}>
              <option value="">—</option>
              {onaylayanlar.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Notlar</label>
            <input name="notlar" className={inputCls} />
          </div>
          <button className={`${btnPrimary} lg:col-span-5 md:col-span-3`}>+ Personel Kaydı</button>
        </form>

        <div className={`${cardCls} overflow-x-auto`}>
          <table className="w-full text-sm min-w-[1000px]">
            <thead>
              <tr className="text-left text-xs text-kb-muted border-b bg-[#eef2f6]">
                <th className="p-3">Tarih</th>
                <th className="p-3">Ad Soyad</th>
                <th className="p-3">Giriş</th>
                <th className="p-3">Çıkış</th>
                <th className="p-3">Normal</th>
                <th className="p-3">Mesai</th>
                <th className="p-3">Toplam</th>
                <th className="p-3">Tip</th>
                <th className="p-3">İş</th>
              </tr>
            </thead>
            <tbody>
              {personelKayitlar.map((k) => (
                <tr key={k.id} className="border-b border-kb-border/60">
                  <td className="p-3">{k.tarih.toLocaleDateString("tr-TR")}</td>
                  <td className="p-3">{k.personnel.adSoyad}</td>
                  <td className="p-3">{k.girisSaati}</td>
                  <td className="p-3">{k.cikisSaati}</td>
                  <td className="p-3">{k.normalSaat.toFixed(2)}</td>
                  <td className="p-3">{k.mesaiSaat.toFixed(2)}</td>
                  <td className="p-3 font-medium">{k.toplamSaat.toFixed(2)}</td>
                  <td className="p-3">{CALISMA_TIPI_LABELS[k.calismaTipi]}</td>
                  <td className="p-3">{k.yapilanIs ?? "—"}</td>
                </tr>
              ))}
              <tr className="bg-[#eef2f6] font-semibold">
                <td colSpan={4} className="p-3">TOPLAM</td>
                <td className="p-3">{normalToplam.toFixed(2)}</td>
                <td className="p-3">{mesaiToplam.toFixed(2)}</td>
                <td className="p-3">{personelToplam.toFixed(2)}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-kb-ink">Araç Günlük Takip</h2>
        <form
          action={aracGunlukOlustur}
          className={`${cardCls} p-4 grid md:grid-cols-3 lg:grid-cols-5 gap-3 items-end`}
        >
          <div>
            <label className="text-xs text-kb-muted block mb-1">Tarih *</label>
            <input name="tarih" type="date" required defaultValue={today} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Plaka *</label>
            <select name="vehicleId" required className={inputCls}>
              <option value="">—</option>
              {araclar.map((a) => (
                <option key={a.id} value={a.id}>{a.plaka} — {a.ad ?? ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Şoför</label>
            <select name="driverId" className={inputCls}>
              <option value="">—</option>
              {soforler.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Giriş *</label>
            <input name="girisSaati" type="time" required defaultValue="08:00" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Çıkış *</label>
            <input name="cikisSaati" type="time" required defaultValue="17:00" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Görev / İş</label>
            <input name="gorevTanimi" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Yer / Bölge</label>
            <input name="yerBolge" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Yakıt (Lt)</label>
            <input name="yakitLitre" type="number" step="0.01" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Yakıt Türü</label>
            <select name="yakitTuru" className={inputCls}>
              {Object.entries(YAKIT_TURU_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-kb-muted block mb-1">Birim Fiyat (yakıt için)</label>
            <input name="birimFiyat" type="number" step="0.01" className={inputCls} />
          </div>
          <button className={`${btnPrimary} lg:col-span-5 md:col-span-3`}>+ Araç Kaydı</button>
        </form>

        <div className={`${cardCls} overflow-x-auto`}>
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-left text-xs text-kb-muted border-b bg-[#eef2f6]">
                <th className="p-3">Tarih</th>
                <th className="p-3">Plaka</th>
                <th className="p-3">Şoför</th>
                <th className="p-3">İş</th>
                <th className="p-3">Yer</th>
                <th className="p-3">Giriş</th>
                <th className="p-3">Çıkış</th>
                <th className="p-3">Çalışma Saati</th>
                <th className="p-3">Yakıt</th>
              </tr>
            </thead>
            <tbody>
              {aracKayitlar.map((k) => (
                <tr key={k.id} className="border-b border-kb-border/60">
                  <td className="p-3">{k.tarih.toLocaleDateString("tr-TR")}</td>
                  <td className="p-3">
                    <Link href={`/araclar/${k.vehicleId}`} className="text-kb-navy hover:underline font-mono">
                      {k.vehicle.plaka}
                    </Link>
                  </td>
                  <td className="p-3">{k.driver?.name ?? k.soforAdi ?? "—"}</td>
                  <td className="p-3">{k.gorevTanimi ?? "—"}</td>
                  <td className="p-3">{k.yerBolge ?? "—"}</td>
                  <td className="p-3">{k.girisSaati}</td>
                  <td className="p-3">{k.cikisSaati}</td>
                  <td className="p-3 font-medium">{k.calismaSaati.toFixed(2)}</td>
                  <td className="p-3">
                    {k.yakitLitre != null ? Number(k.yakitLitre).toLocaleString("tr-TR") : "—"}
                  </td>
                </tr>
              ))}
              <tr className="bg-[#eef2f6] font-semibold">
                <td colSpan={7} className="p-3">TOPLAM</td>
                <td className="p-3">{aracSaat.toFixed(2)}</td>
                <td className="p-3">{aracYakit.toLocaleString("tr-TR")}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <div className={`${cardCls} p-4`}>
          <h3 className="font-semibold mb-3">Araç Bazlı Özet</h3>
          <ul className="space-y-2 text-sm">
            {[...aracBazli.values()].map((a) => (
              <li key={a.plaka} className="flex justify-between">
                <span className="font-mono">{a.plaka}</span>
                <span>{a.saat.toFixed(1)} sa · {a.yakit.toLocaleString("tr-TR")} Lt</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={`${cardCls} p-4`}>
          <h3 className="font-semibold mb-3">Personel Bazlı Özet</h3>
          <ul className="space-y-2 text-sm">
            {[...personelBazli.values()].map((p) => (
              <li key={p.ad} className="flex justify-between">
                <span>{p.ad}</span>
                <span>N {p.normal.toFixed(1)} · M {p.mesai.toFixed(1)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
