import { prisma } from "@kars/db";
import {
  gercekTuketim,
  tuketimDurumu,
  YAKIT_TIPI_LABELS,
  AY_ADLARI,
  sayacFarkiMaxMin,
  ortBirimFiyat,
} from "@kars/shared";
import { cardCls, inputCls, btnPrimary } from "@/lib/ui";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { departmentScope, requirePageAccess } from "@/lib/authz";

export const dynamic = "force-dynamic";

const AYLAR = [...AY_ADLARI];

export default async function AkaryakitPage({
  searchParams,
}: {
  searchParams: Promise<{ mudurluk?: string; ay?: string }>;
}) {
  const session = await requirePageAccess("/akaryakit");
  const sp = await searchParams;
  const ayAdi = (sp.ay && AYLAR.includes(sp.ay as (typeof AYLAR)[number])
    ? sp.ay
    : AYLAR[new Date().getMonth()]) as (typeof AYLAR)[number];
  const ayIndex = AYLAR.indexOf(ayAdi);
  const dept = departmentScope(session);
  const mudurlukFilter = dept.departmentId ?? sp.mudurluk;

  const vehicleWhere = {
    envanterDurumu: { not: "HURDAYA_AYRILDI" as const },
    ...(mudurlukFilter ? { departmentId: mudurlukFilter } : {}),
  };

  const [araclar, kayitlar, mudurlukler] = await Promise.all([
    prisma.vehicle.findMany({
      where: vehicleWhere,
      include: { department: true },
      orderBy: { plaka: "asc" },
    }),
    prisma.fuelRecord.findMany({
      where: mudurlukFilter
        ? { vehicle: { departmentId: mudurlukFilter } }
        : undefined,
      include: { vehicle: true },
    }),
    prisma.department.findMany({ where: { aktif: true }, orderBy: { name: "asc" } }),
  ]);

  const analiz = araclar
    .map((a) => {
      const rows = kayitlar.filter((k) => k.vehicleId === a.id);
      const toplamLitre = rows.reduce((s, r) => s + Number(r.litre), 0);
      const toplamTutar = rows.reduce((s, r) => s + Number(r.tutar), 0);
      const sayaclar = rows.map((r) => r.sayac).filter((s): s is number => s != null);
      const sayacFarki = sayacFarkiMaxMin(sayaclar);
      const tip =
        a.sayacTipi === "SAAT" || a.sayacBirim === "SAAT"
          ? ("SAAT" as const)
          : ("KM" as const);
      const gercek = gercekTuketim(toplamLitre, sayacFarki, tip);
      const norm = a.normTuketim ?? 0;
      const durum =
        gercek != null && norm > 0 ? tuketimDurumu(gercek, norm) : null;
      return { a, toplamLitre, toplamTutar, sayacFarki, gercek, norm, durum, tip };
    });

  const aylik = araclar
    .filter((a) => !mudurlukFilter || a.departmentId === mudurlukFilter)
    .map((a) => {
      const rows = kayitlar.filter((k) => {
        if (k.vehicleId !== a.id) return false;
        if (ayIndex < 0) return true;
        return k.tarih.getMonth() === ayIndex;
      });
      const litre = rows.reduce((s, r) => s + Number(r.litre), 0);
      const tutar = rows.reduce((s, r) => s + Number(r.tutar), 0);
      return {
        plaka: a.plaka,
        yakit: a.yakitTipi ? YAKIT_TIPI_LABELS[a.yakitTipi] ?? a.yakitTipi : "—",
        litre,
        tutar,
        adet: rows.length,
        ort: ortBirimFiyat(tutar, litre),
      };
    })
    .filter((r) => r.adet > 0 || !sp.ay);

  return (
    <div className="space-y-6">
      <div>
        <PageHeader title="Akaryakıt Tüketim Analizi" />
        <p className="text-sm text-kb-muted">
          Excel: Araç Tanımlama + Yakıt Alım + Tüketim Analizi + Aylık Rapor. Tutar ve tüketim
          formülleri sunucuda hesaplanır. Kayıt girişi{" "}
          <Link href="/yakit" className="text-kb-navy hover:underline">Yakıt Takip</Link> üzerinden.
        </p>
      </div>

      <form className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-kb-muted block mb-1">Müdürlük</label>
          <select name="mudurluk" defaultValue={sp.mudurluk ?? ""} className={inputCls}>
            <option value="">Tümü</option>
            {mudurlukler.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Ay</label>
          <select name="ay" defaultValue={ayAdi} className={inputCls}>
            {AYLAR.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <button className={btnPrimary}>Filtrele</button>
      </form>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-kb-ink">Tüketim Analizi</h2>
        <div className={`${cardCls} overflow-x-auto`}>
          <table className="w-full text-sm min-w-[1000px]">
            <thead>
              <tr className="text-left text-xs text-kb-muted border-b bg-[#eef2f6]">
                <th className="p-3">Plaka</th>
                <th className="p-3">Müdürlük</th>
                <th className="p-3">Sayaç Tipi</th>
                <th className="p-3">Toplam Litre</th>
                <th className="p-3">Toplam Tutar</th>
                <th className="p-3">Sayaç Farkı</th>
                <th className="p-3">Gerçek Tüketim</th>
                <th className="p-3">Norm</th>
                <th className="p-3">Durum</th>
              </tr>
            </thead>
            <tbody>
              {analiz.map(({ a, toplamLitre, toplamTutar, sayacFarki, gercek, norm, durum, tip }) => (
                <tr key={a.id} className="border-b border-kb-border/60">
                  <td className="p-3 font-mono">
                    <Link href={`/araclar/${a.id}`} className="text-kb-navy hover:underline">
                      {a.plaka}
                    </Link>
                  </td>
                  <td className="p-3">{a.department?.shortName ?? "—"}</td>
                  <td className="p-3">{tip === "KM" ? "Kilometre" : "Saat"}</td>
                  <td className="p-3">{toplamLitre.toLocaleString("tr-TR")}</td>
                  <td className="p-3">{toplamTutar.toLocaleString("tr-TR")} ₺</td>
                  <td className="p-3">{sayacFarki.toLocaleString("tr-TR")}</td>
                  <td className="p-3">
                    {gercek != null ? gercek.toFixed(2) : "—"}
                  </td>
                  <td className="p-3">{norm || "—"}</td>
                  <td className="p-3 font-medium">{durum ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-kb-ink">Aylık Rapor — {ayAdi}</h2>
        <div className={`${cardCls} overflow-x-auto`}>
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-left text-xs text-kb-muted border-b bg-[#eef2f6]">
                <th className="p-3">Plaka</th>
                <th className="p-3">Litre</th>
                <th className="p-3">Tutar</th>
                <th className="p-3">İşlem</th>
                <th className="p-3">Ort. Birim Fiyat</th>
              </tr>
            </thead>
            <tbody>
              {aylik.map((r) => (
                <tr key={r.plaka} className="border-b border-kb-border/60">
                  <td className="p-3 font-mono">{r.plaka}</td>
                  <td className="p-3">{r.litre.toLocaleString("tr-TR")}</td>
                  <td className="p-3">{r.tutar.toLocaleString("tr-TR")} ₺</td>
                  <td className="p-3">{r.adet}</td>
                  <td className="p-3">{r.ort != null ? r.ort.toFixed(2) : "—"}</td>
                </tr>
              ))}
              <tr className="bg-[#eef2f6] font-semibold">
                <td className="p-3">TOPLAM</td>
                <td className="p-3">
                  {aylik.reduce((s, r) => s + r.litre, 0).toLocaleString("tr-TR")}
                </td>
                <td className="p-3">
                  {aylik.reduce((s, r) => s + r.tutar, 0).toLocaleString("tr-TR")} ₺
                </td>
                <td className="p-3">{aylik.reduce((s, r) => s + r.adet, 0)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
