import { prisma } from "@kars/db";
import { cardCls, inputCls, btnPrimary } from "@/lib/ui";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { departmentScope, requirePageAccess } from "@/lib/authz";
import { akaryakitAnalizi, AY_LISTESI } from "@/lib/akaryakit-analiz";

export const dynamic = "force-dynamic";

export default async function AkaryakitPage({
  searchParams,
}: {
  searchParams: Promise<{ mudurluk?: string; ay?: string }>;
}) {
  const session = await requirePageAccess("/akaryakit");
  const sp = await searchParams;
  const dept = departmentScope(session);
  const mudurlukFilter = dept.departmentId ?? sp.mudurluk;

  const [{ ay: ayAdi, analiz, aylik: aylikTumu }, mudurlukler] = await Promise.all([
    akaryakitAnalizi({ departmentId: mudurlukFilter, ay: sp.ay }),
    prisma.department.findMany({ where: { aktif: true }, orderBy: { name: "asc" } }),
  ]);

  const aylik = aylikTumu.filter((r) => r.adet > 0 || !sp.ay);

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
            {AY_LISTESI.map((a) => (
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
              {analiz.map((r) => (
                <tr key={r.vehicleId} className="border-b border-kb-border/60">
                  <td className="p-3 font-mono">
                    <Link href={`/araclar/${r.vehicleId}`} className="text-kb-navy hover:underline">
                      {r.plaka}
                    </Link>
                  </td>
                  <td className="p-3">{r.mudurluk ?? "—"}</td>
                  <td className="p-3">{r.sayacTipi === "KM" ? "Kilometre" : "Saat"}</td>
                  <td className="p-3">{r.toplamLitre.toLocaleString("tr-TR")}</td>
                  <td className="p-3">{r.toplamTutar.toLocaleString("tr-TR")} ₺</td>
                  <td className="p-3">{r.sayacFarki.toLocaleString("tr-TR")}</td>
                  <td className="p-3">
                    {r.gercekTuketim != null ? r.gercekTuketim.toFixed(2) : "—"}
                  </td>
                  <td className="p-3">{r.norm || "—"}</td>
                  <td className="p-3 font-medium">{r.durum ?? "—"}</td>
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
                  <td className="p-3">
                    {r.ortBirimFiyat != null ? r.ortBirimFiyat.toFixed(2) : "—"}
                  </td>
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
