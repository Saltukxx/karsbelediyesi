import { prisma } from "@kars/db";
import { yakitOlustur } from "@/lib/actions/vehicles";
import { YAKIT_TURU_LABELS } from "@kars/shared";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { departmentScope, requirePageAccess } from "@/lib/authz";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-md border border-kb-border px-3 py-2 text-sm";

export default async function YakitPage() {
  const session = await requirePageAccess("/yakit");
  const dept = departmentScope(session);
  const vehicleWhere = {
    envanterDurumu: { not: "HURDAYA_AYRILDI" as const },
    ...dept,
  };
  const fuelWhere = dept.departmentId
    ? { vehicle: { departmentId: dept.departmentId } }
    : undefined;

  const [kayitlar, araclar, personeller, toplam] = await Promise.all([
    prisma.fuelRecord.findMany({
      where: fuelWhere,
      orderBy: { tarih: "desc" },
      take: 50,
      include: { vehicle: true, sorumluPersonel: true },
    }),
    prisma.vehicle.findMany({
      where: vehicleWhere,
      orderBy: { plaka: "asc" },
    }),
    prisma.personnel.findMany({
      where: { durum: "AKTIF", ...dept },
      orderBy: { adSoyad: "asc" },
    }),
    prisma.fuelRecord.aggregate({
      where: fuelWhere,
      _sum: { litre: true, tutar: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title="Yakıt Takip Çizelgesi" />
      <p className="text-sm text-kb-muted">
        Toplam tutar otomatik hesaplanır: litre × birim fiyat (Excel formülü).
      </p>

      <form action={yakitOlustur} className="rounded-lg border border-kb-border bg-white shadow-sm p-4 grid md:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
        <div>
          <label className="text-xs text-kb-muted block mb-1">Tarih</label>
          <input name="tarih" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Plaka *</label>
          <select name="vehicleId" required className={inputCls}>
            <option value="">— Seçiniz —</option>
            {araclar.map((a) => (
              <option key={a.id} value={a.id}>{a.plaka} — {a.ad ?? ""}</option>
            ))}
          </select>
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
          <label className="text-xs text-kb-muted block mb-1">Miktar (Litre) *</label>
          <input name="litre" type="number" step="0.01" required className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Birim Fiyat (TL) *</label>
          <input name="birimFiyat" type="number" step="0.01" required className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Sayaç (KM/Saat)</label>
          <input name="sayac" type="number" step="0.1" className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Sorumlu Personel</label>
          <select name="sorumluPersonelId" className={inputCls}>
            <option value="">— Seçiniz —</option>
            {personeller.map((p) => (
              <option key={p.id} value={p.id}>{p.adSoyad}</option>
            ))}
          </select>
        </div>
        <button className="rounded-md bg-kb-navy hover:bg-kb-navy-soft text-white px-4 py-2 text-sm font-medium lg:col-span-7 md:col-span-4">
          + Yakıt Kaydı Ekle
        </button>
      </form>

      <div className="rounded-lg border border-kb-border bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left text-xs text-kb-muted border-b bg-[#eef2f6]">
              <th className="p-3">No</th>
              <th className="p-3">Tarih</th>
              <th className="p-3">Plaka</th>
              <th className="p-3">Araç Adı</th>
              <th className="p-3">Yakıt Türü</th>
              <th className="p-3">Litre</th>
              <th className="p-3">Birim Fiyat</th>
              <th className="p-3">Toplam Tutar</th>
              <th className="p-3">Sayaç</th>
              <th className="p-3">Sorumlu</th>
            </tr>
          </thead>
          <tbody>
            {kayitlar.map((y, i) => (
              <tr key={y.id} className="border-b border-kb-border/60">
                <td className="p-3 text-kb-muted">{kayitlar.length - i}</td>
                <td className="p-3">{y.tarih.toLocaleDateString("tr-TR")}</td>
                <td className="p-3 font-mono">
                  <Link href={`/araclar/${y.vehicleId}`} className="text-kb-navy hover:underline">
                    {y.vehicle.plaka}
                  </Link>
                </td>
                <td className="p-3">{y.vehicle.ad ?? "—"}</td>
                <td className="p-3">{YAKIT_TURU_LABELS[y.yakitTuru]}</td>
                <td className="p-3">{Number(y.litre).toLocaleString("tr-TR")}</td>
                <td className="p-3">{Number(y.birimFiyat).toLocaleString("tr-TR")} ₺</td>
                <td className="p-3 font-medium">{Number(y.tutar).toLocaleString("tr-TR")} ₺</td>
                <td className="p-3">{y.sayac?.toLocaleString("tr-TR") ?? "—"}</td>
                <td className="p-3">{y.sorumluPersonel?.adSoyad ?? "—"}</td>
              </tr>
            ))}
            <tr className="bg-[#eef2f6] font-semibold">
              <td colSpan={5} className="p-3">TOPLAM YAKIT GİDERİ</td>
              <td className="p-3">{Number(toplam._sum.litre ?? 0).toLocaleString("tr-TR")} Lt</td>
              <td />
              <td className="p-3">{Number(toplam._sum.tutar ?? 0).toLocaleString("tr-TR")} ₺</td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
