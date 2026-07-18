import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@kars/db";
import { aracGuncelle } from "@/lib/actions/vehicles";
import { AracForm } from "../AracForm";
import {
  BAKIM_TURU_LABELS,
  BAKIM_DURUM_LABELS,
  YAKIT_TURU_LABELS,
  GOREV_DURUM_LABELS,
} from "@kars/shared";
import { requirePageAccess } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function AracDetayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAccess("/araclar");
  const { id } = await params;
  const arac = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      maintenanceRecords: { orderBy: { bakimTarihi: "desc" }, take: 20 },
      fuelRecords: { orderBy: { tarih: "desc" }, take: 20 },
      tasks: { orderBy: { talepTarihi: "desc" }, take: 20, include: { talepEdenDepartment: true } },
    },
  });
  if (!arac) notFound();

  const [cinsler, mudurlukler, soforler, bakimToplam, yakitToplam] = await Promise.all([
    prisma.vehicleType.findMany({ where: { aktif: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { aktif: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { role: "DRIVER", aktif: true }, orderBy: { name: "asc" } }),
    prisma.maintenanceRecord.aggregate({ where: { vehicleId: id }, _sum: { maliyet: true } }),
    prisma.fuelRecord.aggregate({ where: { vehicleId: id }, _sum: { litre: true, tutar: true } }),
  ]);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/araclar" className="text-kb-muted hover:text-kb-muted">←</Link>
        <h1 className="font-brand text-2xl font-semibold tracking-tight text-kb-navy font-mono">{arac.plaka}</h1>
        <span className="text-kb-muted">{arac.ad}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div className="rounded-lg border border-kb-border bg-white shadow-sm p-4">
          <div className="text-xs text-kb-muted">Toplam Bakım Maliyeti</div>
          <div className="text-xl font-bold">
            {Number(bakimToplam._sum.maliyet ?? 0).toLocaleString("tr-TR")} ₺
          </div>
        </div>
        <div className="rounded-lg border border-kb-border bg-white shadow-sm p-4">
          <div className="text-xs text-kb-muted">Toplam Yakıt</div>
          <div className="text-xl font-bold">
            {Number(yakitToplam._sum.litre ?? 0).toLocaleString("tr-TR")} Lt
          </div>
        </div>
        <div className="rounded-lg border border-kb-border bg-white shadow-sm p-4">
          <div className="text-xs text-kb-muted">Toplam Yakıt Gideri</div>
          <div className="text-xl font-bold">
            {Number(yakitToplam._sum.tutar ?? 0).toLocaleString("tr-TR")} ₺
          </div>
        </div>
        <div className="rounded-lg border border-kb-border bg-white shadow-sm p-4">
          <div className="text-xs text-kb-muted">Toplam Görev</div>
          <div className="text-xl font-bold">{arac.tasks.length}</div>
        </div>
      </div>

      <AracForm action={aracGuncelle} arac={arac} cinsler={cinsler} mudurlukler={mudurlukler} soforler={soforler} />

      <section className="rounded-lg border border-kb-border bg-white shadow-sm p-5 overflow-x-auto">
        <h2 className="text-sm font-semibold text-kb-muted uppercase mb-3">Bakım Geçmişi</h2>
        {arac.maintenanceRecords.length === 0 ? (
          <p className="text-sm text-kb-muted">Bakım kaydı yok.</p>
        ) : (
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-left text-xs text-kb-muted border-b">
                <th className="py-2 pr-2">Tarih</th>
                <th className="py-2 pr-2">Tür</th>
                <th className="py-2 pr-2">Yapılan İşlemler</th>
                <th className="py-2 pr-2">Maliyet</th>
                <th className="py-2 pr-2">Yapan</th>
                <th className="py-2">Durum</th>
              </tr>
            </thead>
            <tbody>
              {arac.maintenanceRecords.map((b) => (
                <tr key={b.id} className="border-b border-kb-border/60">
                  <td className="py-2 pr-2">{b.bakimTarihi.toLocaleDateString("tr-TR")}</td>
                  <td className="py-2 pr-2">{BAKIM_TURU_LABELS[b.bakimTuru]}</td>
                  <td className="py-2 pr-2">{b.yapilanIslemler ?? "—"}</td>
                  <td className="py-2 pr-2">
                    {b.maliyet != null ? `${Number(b.maliyet).toLocaleString("tr-TR")} ₺` : "—"}
                  </td>
                  <td className="py-2 pr-2">{b.yapanFirmaPersonel ?? "—"}</td>
                  <td className="py-2">{BAKIM_DURUM_LABELS[b.durum]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-lg border border-kb-border bg-white shadow-sm p-5 overflow-x-auto">
        <h2 className="text-sm font-semibold text-kb-muted uppercase mb-3">Yakıt Geçmişi</h2>
        {arac.fuelRecords.length === 0 ? (
          <p className="text-sm text-kb-muted">Yakıt kaydı yok.</p>
        ) : (
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-left text-xs text-kb-muted border-b">
                <th className="py-2 pr-2">Tarih</th>
                <th className="py-2 pr-2">Tür</th>
                <th className="py-2 pr-2">Litre</th>
                <th className="py-2 pr-2">Birim Fiyat</th>
                <th className="py-2 pr-2">Tutar</th>
                <th className="py-2">Sayaç</th>
              </tr>
            </thead>
            <tbody>
              {arac.fuelRecords.map((y) => (
                <tr key={y.id} className="border-b border-kb-border/60">
                  <td className="py-2 pr-2">{y.tarih.toLocaleDateString("tr-TR")}</td>
                  <td className="py-2 pr-2">{YAKIT_TURU_LABELS[y.yakitTuru]}</td>
                  <td className="py-2 pr-2">{Number(y.litre).toLocaleString("tr-TR")}</td>
                  <td className="py-2 pr-2">{Number(y.birimFiyat).toLocaleString("tr-TR")} ₺</td>
                  <td className="py-2 pr-2 font-medium">{Number(y.tutar).toLocaleString("tr-TR")} ₺</td>
                  <td className="py-2">{y.sayac?.toLocaleString("tr-TR") ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-lg border border-kb-border bg-white shadow-sm p-5 overflow-x-auto">
        <h2 className="text-sm font-semibold text-kb-muted uppercase mb-3">Görev Geçmişi</h2>
        {arac.tasks.length === 0 ? (
          <p className="text-sm text-kb-muted">Görev kaydı yok.</p>
        ) : (
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-left text-xs text-kb-muted border-b">
                <th className="py-2 pr-2">Görev No</th>
                <th className="py-2 pr-2">Talep Tarihi</th>
                <th className="py-2 pr-2">Talep Eden</th>
                <th className="py-2 pr-2">Görev Yeri</th>
                <th className="py-2 pr-2">Süre (Sa)</th>
                <th className="py-2 pr-2">KM Farkı</th>
                <th className="py-2">Durum</th>
              </tr>
            </thead>
            <tbody>
              {arac.tasks.map((g) => (
                <tr key={g.id} className="border-b border-kb-border/60">
                  <td className="py-2 pr-2 font-mono">{g.gorevNo}</td>
                  <td className="py-2 pr-2">{g.talepTarihi.toLocaleDateString("tr-TR")}</td>
                  <td className="py-2 pr-2">{g.talepEdenDepartment?.shortName ?? "—"}</td>
                  <td className="py-2 pr-2">{g.gorevYeri ?? "—"}</td>
                  <td className="py-2 pr-2">{g.sureSaat?.toFixed(1) ?? "—"}</td>
                  <td className="py-2 pr-2">{g.kmFarki?.toLocaleString("tr-TR") ?? "—"}</td>
                  <td className="py-2">{GOREV_DURUM_LABELS[g.durum]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
