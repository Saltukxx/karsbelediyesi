import { prisma } from "@kars/db";
import { ONCELIK_LABELS, toplamOperasyonMaliyeti } from "@kars/shared";
import { cardCls, btnPrimary } from "@/lib/ui";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataTable } from "@/components/ui/DataTable";
import { departmentScope, requirePageAccess } from "@/lib/authz";
import { computeSlaSummary } from "@/lib/sla";
import { gorevMaliyetleri, paraFormat, type GorevMaliyet } from "@/lib/task-cost";

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

interface MahalleRow {
  ad: string;
  toplam: number;
  acik: number;
  kapanan: number;
  /** Kapanan şikayetlerin ortalama çözüm süresi (gün) */
  ortCozumGun: number | null;
  enSikTip: string;
}

/** Son 90 gündeki şikayetlerin mahalle bazlı kırılımı */
async function mahalleAnalizi(dept: {
  departmentId?: string | { in: string[] };
}): Promise<MahalleRow[]> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const complaints = await prisma.complaint.findMany({
    where: { ...dept, kayitTarihi: { gte: since } },
    select: {
      durum: true,
      createdAt: true,
      kapanisTarihi: true,
      neighborhood: { select: { name: true } },
      complaintType: { select: { name: true } },
    },
  });

  const byMahalle = new Map<
    string,
    { toplam: number; acik: number; kapanan: number; cozumGunler: number[]; tipler: Map<string, number> }
  >();
  for (const c of complaints) {
    const ad = c.neighborhood?.name ?? "Mahalle belirtilmemiş";
    let row = byMahalle.get(ad);
    if (!row) {
      row = { toplam: 0, acik: 0, kapanan: 0, cozumGunler: [], tipler: new Map() };
      byMahalle.set(ad, row);
    }
    row.toplam += 1;
    if (c.durum === "KAPATILDI") {
      row.kapanan += 1;
      if (c.kapanisTarihi) {
        row.cozumGunler.push(
          (c.kapanisTarihi.getTime() - c.createdAt.getTime()) / 86_400_000,
        );
      }
    } else if (c.durum !== "IPTAL") {
      row.acik += 1;
    }
    const tip = c.complaintType?.name ?? "Belirsiz";
    row.tipler.set(tip, (row.tipler.get(tip) ?? 0) + 1);
  }

  return Array.from(byMahalle.entries())
    .map(([ad, r]) => ({
      ad,
      toplam: r.toplam,
      acik: r.acik,
      kapanan: r.kapanan,
      ortCozumGun:
        r.cozumGunler.length > 0
          ? Math.round(
              (r.cozumGunler.reduce((a, b) => a + b, 0) / r.cozumGunler.length) * 10,
            ) / 10
          : null,
      enSikTip:
        Array.from(r.tipler.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—",
    }))
    .sort((a, b) => (b.ortCozumGun ?? -1) - (a.ortCozumGun ?? -1));
}

interface MaliyetSatiri {
  id: string;
  gorevNo: string;
  plaka: string;
  gorevTanimi: string | null;
  mudurluk: string;
  maliyet: GorevMaliyet;
}

/** Son 30 günde kapanan görevlerin maliyet kırılımı */
async function isMaliyeti(dept: {
  departmentId?: string | { in: string[] };
}): Promise<MaliyetSatiri[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const tasks = await prisma.vehicleTask.findMany({
    where: {
      durum: "TAMAMLANDI",
      girisTarihi: { gte: since },
      ...(dept.departmentId
        ? {
            OR: [
              { talepEdenDepartmentId: dept.departmentId },
              { vehicle: { departmentId: dept.departmentId } },
            ],
          }
        : {}),
    },
    orderBy: { girisTarihi: "desc" },
    take: 200,
    select: {
      id: true,
      gorevNo: true,
      gorevTanimi: true,
      sureSaat: true,
      kmFarki: true,
      driverId: true,
      vehicleId: true,
      maliyet: true,
      vehicle: { select: { plaka: true, normTuketim: true } },
      talepEdenDepartment: { select: { shortName: true, name: true } },
    },
  });

  const maliyetler = await gorevMaliyetleri(
    tasks.map((t) => ({
      id: t.id,
      sureSaat: t.sureSaat,
      kmFarki: t.kmFarki,
      driverId: t.driverId,
      vehicleId: t.vehicleId,
      normTuketim: t.vehicle.normTuketim,
      manuelMaliyet: t.maliyet != null ? Number(t.maliyet) : null,
    })),
  );

  return tasks.map((t) => ({
    id: t.id,
    gorevNo: t.gorevNo,
    plaka: t.vehicle.plaka,
    gorevTanimi: t.gorevTanimi,
    mudurluk:
      t.talepEdenDepartment?.shortName || t.talepEdenDepartment?.name || "—",
    maliyet: maliyetler.get(t.id) ?? {
      yakit: 0,
      yakitTahmini: false,
      malzeme: 0,
      iscilik: 0,
      diger: 0,
      toplam: 0,
    },
  }));
}

export default async function RaporlarPage() {
  const session = await requirePageAccess("/raporlar");
  const dept = departmentScope(session);
  const sla = await computeSlaSummary(session);
  const mahalleler = await mahalleAnalizi(dept);
  const maliyetSatirlari = await isMaliyeti(dept);

  const mudurlukToplamlari = new Map<string, number>();
  for (const s of maliyetSatirlari) {
    mudurlukToplamlari.set(
      s.mudurluk,
      (mudurlukToplamlari.get(s.mudurluk) ?? 0) + s.maliyet.toplam,
    );
  }

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

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-kb-ink">
          Mahalle Analizi (son 90 gün)
        </h2>
        <div className={`${cardCls} overflow-hidden`}>
          <DataTable
            framed={false}
            empty={mahalleler.length === 0}
            emptyTitle="Son 90 günde konumlu şikayet yok"
          >
            <thead>
              <tr>
                <th>Mahalle</th>
                <th>Toplam</th>
                <th>Açık</th>
                <th>Kapanan</th>
                <th>Ort. çözüm (gün)</th>
                <th>En sık tip</th>
              </tr>
            </thead>
            <tbody>
              {mahalleler.map((m) => (
                <tr key={m.ad}>
                  <td className="font-medium">{m.ad}</td>
                  <td>{m.toplam}</td>
                  <td>{m.acik > 0 ? <StatusBadge label={String(m.acik)} /> : 0}</td>
                  <td>{m.kapanan}</td>
                  <td>{m.ortCozumGun ?? "—"}</td>
                  <td className="text-xs text-kb-muted">{m.enSikTip}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-kb-ink">
          İş Maliyeti (son 30 gün kapanan görevler)
        </h2>
        <div className={`${cardCls} overflow-hidden`}>
          <DataTable
            framed={false}
            empty={maliyetSatirlari.length === 0}
            emptyTitle="Son 30 günde kapanan görev yok"
          >
            <thead>
              <tr>
                <th>Görev</th>
                <th>Plaka</th>
                <th>Müdürlük</th>
                <th>Yakıt</th>
                <th>Malzeme</th>
                <th>İşçilik</th>
                <th>Diğer</th>
                <th>Toplam</th>
              </tr>
            </thead>
            <tbody>
              {maliyetSatirlari.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="font-mono text-xs">{s.gorevNo}</span>
                    {s.gorevTanimi && (
                      <div className="max-w-[220px] truncate text-xs text-kb-muted">
                        {s.gorevTanimi}
                      </div>
                    )}
                  </td>
                  <td className="font-mono text-xs">{s.plaka}</td>
                  <td>{s.mudurluk}</td>
                  <td>
                    {paraFormat(s.maliyet.yakit)}
                    {s.maliyet.yakitTahmini && (
                      <span className="ml-1 text-xs text-kb-muted">(tahmini)</span>
                    )}
                  </td>
                  <td>{paraFormat(s.maliyet.malzeme)}</td>
                  <td>{paraFormat(s.maliyet.iscilik)}</td>
                  <td>{paraFormat(s.maliyet.diger)}</td>
                  <td className="font-semibold">{paraFormat(s.maliyet.toplam)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
        {mudurlukToplamlari.size > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from(mudurlukToplamlari.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([mudurluk, toplam]) => (
                <div key={mudurluk} className={`${cardCls} p-4`}>
                  <div className="text-xs text-kb-muted">{mudurluk}</div>
                  <div className="text-xl font-semibold mt-1">{paraFormat(toplam)}</div>
                </div>
              ))}
          </div>
        )}
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
