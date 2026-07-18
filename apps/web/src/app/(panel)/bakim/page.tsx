import { prisma } from "@kars/db";
import { bakimOlustur } from "@/lib/actions/vehicles";
import { BAKIM_TURU_LABELS, BAKIM_DURUM_LABELS } from "@kars/shared";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { departmentScope, requirePageAccess } from "@/lib/authz";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-md border border-kb-border px-3 py-2 text-sm";

export default async function BakimPage() {
  const session = await requirePageAccess("/bakim");
  const dept = departmentScope(session);
  const vehicleWhere = {
    envanterDurumu: { not: "HURDAYA_AYRILDI" as const },
    ...dept,
  };
  const bakimWhere = dept.departmentId
    ? { vehicle: { departmentId: dept.departmentId } }
    : undefined;

  const [kayitlar, araclar, toplam] = await Promise.all([
    prisma.maintenanceRecord.findMany({
      where: bakimWhere,
      orderBy: { bakimTarihi: "desc" },
      take: 50,
      include: { vehicle: { include: { department: true } } },
    }),
    prisma.vehicle.findMany({
      where: vehicleWhere,
      orderBy: { plaka: "asc" },
    }),
    prisma.maintenanceRecord.aggregate({
      where: bakimWhere,
      _sum: { maliyet: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title="Bakım ve Onarım Takip Çizelgesi" />

      {/* Yeni bakım girişi — Excel Bakım Takip satır girişi */}
      <form action={bakimOlustur} className="rounded-lg border border-kb-border bg-white shadow-sm p-4 grid md:grid-cols-4 lg:grid-cols-6 gap-3 items-end">
        <div>
          <label className="text-xs text-kb-muted block mb-1">Bakım Tarihi</label>
          <input name="bakimTarihi" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={inputCls} />
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
          <label className="text-xs text-kb-muted block mb-1">Bakım Türü</label>
          <select name="bakimTuru" className={inputCls}>
            {Object.entries(BAKIM_TURU_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-2">
          <label className="text-xs text-kb-muted block mb-1">Yapılan İşlemler</label>
          <input name="yapilanIslemler" className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Kullanılan Malzeme</label>
          <input name="kullanilanMalzeme" className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Maliyet (TL)</label>
          <input name="maliyet" type="number" step="0.01" className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Yapan Firma / Personel</label>
          <input name="yapanFirmaPersonel" className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Sonraki Bakım</label>
          <input name="sonrakiBakimTarihi" type="date" className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-kb-muted block mb-1">Durum</label>
          <select name="durum" className={inputCls}>
            {Object.entries(BAKIM_DURUM_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <button className="rounded-md bg-kb-navy hover:bg-kb-navy-soft text-white px-4 py-2 text-sm font-medium">
          + Bakım Kaydı Ekle
        </button>
      </form>

      {/* Liste — Excel Bakım Takip sütunları + TOPLAM satırı */}
      <div className="rounded-lg border border-kb-border bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="text-left text-xs text-kb-muted border-b bg-[#eef2f6]">
              <th className="p-3">No</th>
              <th className="p-3">Bakım Tarihi</th>
              <th className="p-3">Plaka</th>
              <th className="p-3">Araç Adı</th>
              <th className="p-3">Bakım Türü</th>
              <th className="p-3">Yapılan İşlemler</th>
              <th className="p-3">Malzeme</th>
              <th className="p-3">Maliyet (TL)</th>
              <th className="p-3">Yapan</th>
              <th className="p-3">Sonraki Bakım</th>
              <th className="p-3">Durum</th>
            </tr>
          </thead>
          <tbody>
            {kayitlar.map((b, i) => (
              <tr key={b.id} className="border-b border-kb-border/60">
                <td className="p-3 text-kb-muted">{kayitlar.length - i}</td>
                <td className="p-3">{b.bakimTarihi.toLocaleDateString("tr-TR")}</td>
                <td className="p-3 font-mono">
                  <Link href={`/araclar/${b.vehicleId}`} className="text-kb-navy hover:underline">
                    {b.vehicle.plaka}
                  </Link>
                </td>
                <td className="p-3">{b.vehicle.ad ?? "—"}</td>
                <td className="p-3">{BAKIM_TURU_LABELS[b.bakimTuru]}</td>
                <td className="p-3">{b.yapilanIslemler ?? "—"}</td>
                <td className="p-3">{b.kullanilanMalzeme ?? "—"}</td>
                <td className="p-3">
                  {b.maliyet != null ? Number(b.maliyet).toLocaleString("tr-TR") : "—"}
                </td>
                <td className="p-3">{b.yapanFirmaPersonel ?? "—"}</td>
                <td className="p-3">
                  {b.sonrakiBakimTarihi?.toLocaleDateString("tr-TR") ?? "—"}
                </td>
                <td className="p-3">{BAKIM_DURUM_LABELS[b.durum]}</td>
              </tr>
            ))}
            <tr className="bg-[#eef2f6] font-semibold">
              <td colSpan={7} className="p-3">TOPLAM BAKIM MALİYETİ</td>
              <td className="p-3">
                {Number(toplam._sum.maliyet ?? 0).toLocaleString("tr-TR")} ₺
              </td>
              <td colSpan={3} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
