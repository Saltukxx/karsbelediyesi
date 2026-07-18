import { prisma } from "@kars/db";
import { ONCELIK_LABELS, toplamOperasyonMaliyeti } from "@kars/shared";
import { cardCls, btnPrimary } from "@/lib/ui";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataTable } from "@/components/ui/DataTable";
import { departmentScope, requirePageAccess } from "@/lib/authz";
import { computeSlaSummary } from "@/lib/sla";

export const dynamic = "force-dynamic";

const EXPORTS = [
  { entity: "sikayetler", label: "Şikayetler", href: "/sikayetler" },
  { entity: "araclar", label: "Araç Envanteri", href: "/araclar" },
  { entity: "bakim", label: "Bakım Takip", href: "/bakim" },
  { entity: "yakit", label: "Yakıt Takip", href: "/yakit" },
  { entity: "gorevler", label: "Görevlendirme", href: "/gorevler" },
  { entity: "personel", label: "Personel", href: "/personel" },
  { entity: "akaryakit", label: "Akaryakıt Analizi", href: "/akaryakit" },
  { entity: "malzeme", label: "Malzeme Depo", href: "/malzeme-depo" },
  { entity: "beton", label: "Beton Reçeteleri", href: "/beton" },
  { entity: "bitum", label: "Bitüm Hareket", href: "/bitum" },
];

export default async function RaporlarPage() {
  const session = await requirePageAccess("/raporlar");
  const dept = departmentScope(session);
  const sla = await computeSlaSummary(session);

  const [sikayet, arac, gorev, yakit, bakim] = await Promise.all([
    prisma.complaint.count({ where: dept }),
    prisma.vehicle.count({ where: dept }),
    prisma.vehicleTask.count({
      where: dept.departmentId
        ? {
            OR: [
              { talepEdenDepartmentId: dept.departmentId },
              { vehicle: { departmentId: dept.departmentId } },
            ],
          }
        : undefined,
    }),
    prisma.fuelRecord.aggregate({
      where: dept.departmentId
        ? { vehicle: { departmentId: dept.departmentId } }
        : undefined,
      _sum: { tutar: true },
    }),
    prisma.maintenanceRecord.aggregate({
      where: dept.departmentId
        ? { vehicle: { departmentId: dept.departmentId } }
        : undefined,
      _sum: { maliyet: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <PageHeader title="Raporlar & Dışa Aktarma" />
        <p className="text-sm text-kb-muted">
          SLA özeti, müdürlük performansı ve Excel dışa aktarma.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-kb-ink">Şikayet SLA</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            ["24 saatten az", sla.bucketLt24h, "Açık kayıtlar"],
            ["1–3 gün", sla.bucket1to3d, "Orta yaş"],
            ["3 günden fazla", sla.bucketGt3d, "Geciken"],
          ].map(([label, val, hint]) => (
            <div key={String(label)} className={`${cardCls} p-4`}>
              <div className="text-xs text-kb-muted">{label}</div>
              <div className="text-2xl font-semibold mt-1 text-kb-navy">{val}</div>
              <div className="text-xs text-kb-muted mt-1">{hint}</div>
            </div>
          ))}
        </div>

        {sla.overdueUrgent.length > 0 && (
          <div className={`${cardCls} overflow-hidden`}>
            <div className="border-b border-kb-border px-4 py-3 font-medium">
              Geciken acil / çok acil (24 saatten fazla)
            </div>
            <DataTable framed={false}>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Arayan</th>
                  <th>Öncelik</th>
                  <th>Müdürlük</th>
                  <th>Kayıt</th>
                </tr>
              </thead>
              <tbody>
                {sla.overdueUrgent.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link
                        href={`/sikayetler/${s.id}`}
                        className="font-mono text-xs text-kb-navy hover:underline"
                      >
                        {s.sikayetNo}
                      </Link>
                    </td>
                    <td>{s.arayanKisi}</td>
                    <td>
                      <StatusBadge
                        label={
                          ONCELIK_LABELS[s.oncelik as keyof typeof ONCELIK_LABELS] ??
                          s.oncelik
                        }
                      />
                    </td>
                    <td>{s.departmentName ?? "—"}</td>
                    <td className="text-xs text-kb-muted">
                      {s.kayitTarihi.toLocaleString("tr-TR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
        )}

        <div className={`${cardCls} overflow-hidden`}>
          <div className="border-b border-kb-border px-4 py-3 font-medium">
            Müdürlük KPI (son 30 gün kapanış)
          </div>
          <DataTable
            framed={false}
            empty={sla.byDepartment.length === 0}
            emptyTitle="Veri yok"
          >
            <thead>
              <tr>
                <th>Müdürlük</th>
                <th>Açık</th>
                <th>Kapatılan (30g)</th>
                <th>Ort. kapanış (gün)</th>
              </tr>
            </thead>
            <tbody>
              {sla.byDepartment.map((row) => (
                <tr key={row.departmentId ?? "none"}>
                  <td>{row.departmentName}</td>
                  <td>{row.acik}</td>
                  <td>{row.kapatilan30g}</td>
                  <td>{row.ortKapanisGun ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      </section>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["Toplam şikayet", sikayet],
          ["Araç", arac],
          ["Görev", gorev],
          [
            "Yakıt + Bakım (₺)",
            toplamOperasyonMaliyeti(
              Number(bakim._sum.maliyet ?? 0),
              Number(yakit._sum.tutar ?? 0),
            ).toLocaleString("tr-TR"),
          ],
        ].map(([label, val]) => (
          <div key={String(label)} className={`${cardCls} p-4`}>
            <div className="text-xs text-kb-muted">{label}</div>
            <div className="text-xl font-semibold mt-1">{val}</div>
          </div>
        ))}
      </div>

      <section className={`${cardCls} divide-y divide-slate-100`}>
        {EXPORTS.map((e) => (
          <div key={e.entity} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="font-medium">{e.label}</div>
              <Link href={e.href} className="text-xs text-kb-navy hover:underline">
                Listeye git
              </Link>
            </div>
            <a href={`/api/export/${e.entity}`} className={btnPrimary}>
              Excel İndir
            </a>
          </div>
        ))}
      </section>
    </div>
  );
}
