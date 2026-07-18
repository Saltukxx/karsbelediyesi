import { prisma } from "@kars/db";
import {
  OPERASYON_DURUM_LABELS,
  ENVANTER_DURUM_LABELS,
  toplamOperasyonMaliyeti,
  mevcutStok,
  stokDurumu,
  betonGuncelStok,
  betonStokDurumu,
  GOREV_DURUM_LABELS,
} from "@kars/shared";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  MessageCircle,
  Package,
  Wrench,
  ClipboardList,
} from "lucide-react";
import { auth } from "@/auth";
import { landingPathForRole } from "@/lib/nav";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { btnPrimary, btnSecondary, sectionTitleCls } from "@/lib/ui";
import { departmentScope, requirePageAccess } from "@/lib/authz";
import { gorevBaslat, gorevKapat } from "@/lib/actions/tasks";
import { computeSlaSummary } from "@/lib/sla";

export const dynamic = "force-dynamic";

function ActionCard({
  href,
  title,
  count,
  hint,
  tone = "navy",
  icon: Icon,
}: {
  href: string;
  title: string;
  count: number;
  hint: string;
  tone?: "navy" | "danger" | "warning" | "success";
  icon: typeof AlertTriangle;
}) {
  const toneCls =
    tone === "danger"
      ? "border-kb-danger/25 bg-kb-danger-bg text-kb-danger"
      : tone === "warning"
        ? "border-kb-warning/30 bg-kb-warning-bg text-kb-warning"
        : tone === "success"
          ? "border-kb-success/25 bg-kb-success-bg text-kb-success"
          : "border-kb-navy/20 bg-kb-navy/5 text-kb-navy";

  return (
    <Link
      href={href}
      className={`flex items-start gap-3 rounded-lg border p-4 transition hover:shadow-sm ${toneCls}`}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0 opacity-80" />
      <div className="min-w-0">
        <div className="text-2xl font-bold tabular-nums">{count}</div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-0.5 text-xs opacity-80">{hint}</div>
      </div>
    </Link>
  );
}

export default async function DashboardPage() {
  await requirePageAccess("/");
  const session = await auth();
  if (!session) redirect("/giris");

  const role = session.user.role;
  const landing = landingPathForRole(role);
  if (role === "CALL_CENTER" && landing !== "/") {
    redirect(landing);
  }

  if (role === "DRIVER" || role === "FIELD_WORKER") {
    const myTasks = await prisma.vehicleTask.findMany({
      where: {
        driverId: session.user.id,
        durum: { in: ["PLANLANDI", "DEVAM_EDIYOR"] },
      },
      orderBy: { talepTarihi: "desc" },
      take: 20,
      include: { vehicle: true, talepEdenDepartment: true },
    });

    return (
      <div className="space-y-6">
        <PageHeader
          title="İşlerim"
          description="Size atanan açık ve devam eden görevler."
          actions={
            <Link href="/gunluk-calisma" className={btnSecondary}>
              Günlük çalışma kaydı
            </Link>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <ActionCard
            href="/gorevler?durum=DEVAM_EDIYOR"
            title="Devam eden"
            count={myTasks.filter((t) => t.durum === "DEVAM_EDIYOR").length}
            hint="Aktif sahadaki işler"
            tone="warning"
            icon={ClipboardList}
          />
          <ActionCard
            href="/gorevler?durum=PLANLANDI"
            title="Planlanan"
            count={myTasks.filter((t) => t.durum === "PLANLANDI").length}
            hint="Başlatılmayı bekleyen"
            tone="navy"
            icon={ClipboardList}
          />
        </div>
        <Card padding={false}>
          <div className="p-5 pb-0">
            <CardHeader title="Görev listesi" />
          </div>
          <DataTable
            framed={false}
            empty={myTasks.length === 0}
            emptyTitle="Atanmış görev yok"
            emptyDescription="Yeni görev atandığında burada görünecek."
            emptyAction={
              <Link href="/gorevler" className="text-sm font-semibold text-kb-navy underline">
                Tüm görevler
              </Link>
            }
          >
            <thead>
              <tr>
                <th>Görev No</th>
                <th>Plaka</th>
                <th>Yer</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {myTasks.map((g) => (
                <tr key={g.id}>
                  <td className="font-mono text-xs">{g.gorevNo}</td>
                  <td className="font-mono">{g.vehicle.plaka}</td>
                  <td>{g.gorevYeri ?? "—"}</td>
                  <td>
                    <StatusBadge label={GOREV_DURUM_LABELS[g.durum]} />
                  </td>
                  <td>
                    {g.durum === "PLANLANDI" ? (
                      <form action={gorevBaslat}>
                        <input type="hidden" name="id" value={g.id} />
                        <button type="submit" className={`${btnPrimary} !py-1.5 !px-3 text-xs`}>
                          Başlat
                        </button>
                      </form>
                    ) : (
                      <form action={gorevKapat} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="id" value={g.id} />
                        <input type="hidden" name="durum" value="TAMAMLANDI" />
                        <button type="submit" className={`${btnSecondary} !py-1.5 !px-3 text-xs`}>
                          Kapat
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Card>
      </div>
    );
  }

  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const dept = departmentScope(session as never);
  const sla = await computeSlaSummary(session as never);

  const [
    toplamSikayet,
    acik,
    devamEden,
    kapatilan,
    cokAcil,
    acil,
    mudurlukDagilim,
    turDagilim,
    aracDurum,
    envanterDurum,
    bakimToplam,
    yakitToplam,
    yaklasanBakimlar,
    onayBekleyenWhatsApp,
    acilSikayet,
    devamGorev,
    yaklasanMuayene,
    materials,
    materialSums,
    betonStocks,
    betonCikis,
    bitumSettings,
    bitumDepots,
    bitumMovements,
  ] = await Promise.all([
    prisma.complaint.count({ where: dept }),
    prisma.complaint.count({ where: { durum: "ACIK", ...dept } }),
    prisma.complaint.count({ where: { durum: "DEVAM_EDIYOR", ...dept } }),
    prisma.complaint.count({ where: { durum: "KAPATILDI", ...dept } }),
    prisma.complaint.count({
      where: { oncelik: "COK_ACIL", durum: { not: "KAPATILDI" }, ...dept },
    }),
    prisma.complaint.count({
      where: { oncelik: "ACIL", durum: { not: "KAPATILDI" }, ...dept },
    }),
    prisma.department.findMany({
      where: {
        aktif: true,
        ...(dept.departmentId ? { id: dept.departmentId } : {}),
      },
      select: {
        id: true,
        name: true,
        _count: { select: { complaints: true } },
        complaints: { select: { durum: true, oncelik: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.complaintType.findMany({
      where: { aktif: true },
      select: {
        name: true,
        complaints: {
          where: dept,
          select: { durum: true },
        },
      },
    }),
    prisma.vehicle.groupBy({
      by: ["operasyonDurumu"],
      where: dept,
      _count: true,
    }),
    prisma.vehicle.groupBy({
      by: ["envanterDurumu"],
      where: dept,
      _count: true,
    }),
    prisma.maintenanceRecord.aggregate({
      where: dept.departmentId
        ? { vehicle: { departmentId: dept.departmentId } }
        : undefined,
      _sum: { maliyet: true },
      _count: true,
    }),
    prisma.fuelRecord.aggregate({
      where: dept.departmentId
        ? { vehicle: { departmentId: dept.departmentId } }
        : undefined,
      _sum: { litre: true, tutar: true },
    }),
    prisma.maintenanceRecord.findMany({
      where: dept.departmentId
        ? { vehicle: { departmentId: dept.departmentId } }
        : undefined,
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { vehicle: { select: { plaka: true, ad: true } } },
    }),
    prisma.whatsAppMessage.count({ where: { onayDurumu: "ONAY_BEKLIYOR" } }),
    prisma.complaint.count({
      where: {
        oncelik: { in: ["ACIL", "COK_ACIL"] },
        durum: { in: ["ACIK", "DEVAM_EDIYOR"] },
        ...dept,
      },
    }),
    prisma.vehicleTask.count({
      where: {
        durum: "DEVAM_EDIYOR",
        ...(dept.departmentId
          ? {
              OR: [
                { talepEdenDepartmentId: dept.departmentId },
                { vehicle: { departmentId: dept.departmentId } },
              ],
            }
          : {}),
      },
    }),
    prisma.vehicle.count({
      where: {
        OR: [
          { muayeneTarihi: { lte: in30 } },
          { sigortaBitis: { lte: in30 } },
          { sonrakiBakimTarihi: { lte: in30 } },
        ],
        envanterDurumu: { not: "HURDAYA_AYRILDI" },
        ...dept,
      },
    }),
    prisma.material.findMany({ where: { aktif: true } }),
    prisma.materialMovement.groupBy({
      by: ["materialId", "tip"],
      _sum: { miktar: true },
    }),
    prisma.concreteStock.findMany(),
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
    prisma.bitumSettings.findUnique({ where: { id: "default" } }),
    prisma.bitumDepot.findMany({ where: { aktif: true } }),
    prisma.bitumMovement.findMany({ select: { tip: true, depoId: true, kaynakDepoId: true, hedefDepoId: true, kullanimDepoId: true, miktarTon: true } }),
  ]);

  const kritikMalzeme = materials.filter((m) => {
    const giris = Number(
      materialSums.find((s) => s.materialId === m.id && s.tip === "GIRIS")?._sum.miktar ?? 0,
    );
    const cikis = Number(
      materialSums.find((s) => s.materialId === m.id && s.tip === "CIKIS")?._sum.miktar ?? 0,
    );
    return stokDurumu(mevcutStok(giris, cikis), m.kritikStok) === "KRITIK";
  }).length;

  const sum = betonCikis._sum;
  const cikisMap: Record<string, number> = {
    Cimento: sum.cimentoKg ?? 0,
    Kum: sum.kumKg ?? 0,
    "Micir 0-5mm": sum.micir05Kg ?? 0,
    "Micir 5-12mm": sum.micir512Kg ?? 0,
    "Micir 12-19mm": sum.micir1219Kg ?? 0,
    Su: sum.suLt ?? 0,
    Katki: sum.katkiKg ?? 0,
  };
  const kritikBeton = betonStocks.filter((s) => {
    const stok = betonGuncelStok(s.baslangicStok, s.toplamGiris, cikisMap[s.malzeme] ?? 0);
    return betonStokDurumu(stok, s.kritikSeviye) === "KRITIK";
  }).length;

  // Bitüm depo doluluk — basit net stok (alış − taşıma çıkış − kullanım)
  let kritikBitum = 0;
  if (bitumSettings && bitumDepots.length) {
    for (const d of bitumDepots) {
      let stok = 0;
      for (const h of bitumMovements) {
        if (h.tip === "ALIS" && h.depoId === d.id) stok += h.miktarTon;
        if (h.tip === "TASIMA" && h.kaynakDepoId === d.id) stok -= h.miktarTon;
        if (h.tip === "TASIMA" && h.hedefDepoId === d.id) stok += h.miktarTon;
        if (h.tip === "KULLANIM" && (h.kullanimDepoId === d.id || h.depoId === d.id)) {
          stok -= h.miktarTon;
        }
      }
      const oran = d.kapasite > 0 ? stok / d.kapasite : 0;
      if (oran <= bitumSettings.kritikEsik) kritikBitum += 1;
    }
  }

  const kritikStokToplam = kritikMalzeme + kritikBeton + kritikBitum;

  const opDurum = Object.fromEntries(aracDurum.map((d) => [d.operasyonDurumu, d._count]));
  const envDurum = Object.fromEntries(envanterDurum.map((d) => [d.envanterDurumu, d._count]));
  const bakimTL = Number(bakimToplam._sum.maliyet ?? 0);
  const yakitLt = Number(yakitToplam._sum.litre ?? 0);
  const yakitTL = Number(yakitToplam._sum.tutar ?? 0);
  const operasyonTL = toplamOperasyonMaliyeti(bakimTL, yakitTL);
  const tarih = new Date().toLocaleDateString("tr-TR", { dateStyle: "long" });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={`${tarih} — bugün ne yapılacak?`}
      />

      <section className="space-y-3">
        <h2 className={sectionTitleCls}>Bugün yapılacaklar</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <ActionCard
            href="/sikayetler?sekme=aktif"
            title="Acil şikayet"
            count={acilSikayet}
            hint="Açık / devam · acil & çok acil"
            tone={acilSikayet > 0 ? "danger" : "navy"}
            icon={AlertTriangle}
          />
          <ActionCard
            href="/whatsapp"
            title="WhatsApp onay"
            count={onayBekleyenWhatsApp}
            hint="Onay bekleyen mesaj"
            tone={onayBekleyenWhatsApp > 0 ? "warning" : "navy"}
            icon={MessageCircle}
          />
          <ActionCard
            href={kritikBeton > 0 ? "/beton?tab=stok" : kritikBitum > 0 ? "/bitum?tab=ozet" : "/malzeme-depo?tab=stok"}
            title="Kritik stok"
            count={kritikStokToplam}
            hint="Malzeme / beton / bitüm"
            tone={kritikStokToplam > 0 ? "danger" : "success"}
            icon={Package}
          />
          <ActionCard
            href="/bakim"
            title="Yaklaşan bakım"
            count={yaklasanMuayene}
            hint="30 gün içinde muayene / sigorta / bakım"
            tone={yaklasanMuayene > 0 ? "warning" : "navy"}
            icon={Wrench}
          />
          <ActionCard
            href="/gorevler?durum=DEVAM_EDIYOR"
            title="Devam eden görev"
            count={devamGorev}
            hint="Sahada devam eden işler"
            tone={devamGorev > 0 ? "warning" : "navy"}
            icon={ClipboardList}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="SLA 24 saatten az" value={sla.bucketLt24h} />
          <StatCard label="SLA 1–3 gün" value={sla.bucket1to3d} tone="warning" />
          <StatCard
            label="SLA 3 günden fazla"
            value={sla.bucketGt3d}
            tone={sla.bucketGt3d > 0 ? "danger" : "navy"}
          />
        </div>
        <p className="text-xs text-kb-muted">
          Detaylı SLA ve müdürlük KPI için{" "}
          <Link href="/raporlar" className="font-semibold text-kb-navy underline">
            Raporlar
          </Link>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={sectionTitleCls}>Şikayet özeti</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Toplam" value={toplamSikayet} />
          <StatCard label="Açık" value={acik} tone="navy" />
          <StatCard label="Devam Eden" value={devamEden} tone="warning" />
          <StatCard label="Kapatılan" value={kapatilan} tone="success" />
          <StatCard label="Çok Acil" value={cokAcil} tone="danger" />
          <StatCard label="Acil" value={acil} tone="warning" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className={sectionTitleCls}>Araç durumu</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <StatCard label={OPERASYON_DURUM_LABELS.MUSAIT} value={opDurum.MUSAIT ?? 0} tone="success" />
          <StatCard label={OPERASYON_DURUM_LABELS.GOREVDE} value={opDurum.GOREVDE ?? 0} tone="danger" />
          <StatCard label={OPERASYON_DURUM_LABELS.BAKIMDA} value={opDurum.BAKIMDA ?? 0} tone="warning" />
          <StatCard label={OPERASYON_DURUM_LABELS.ARIZALI} value={opDurum.ARIZALI ?? 0} tone="danger" />
          <StatCard label={OPERASYON_DURUM_LABELS.PLANLI_BAKIM} value={opDurum.PLANLI_BAKIM ?? 0} />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label={`Envanter: ${ENVANTER_DURUM_LABELS.AKTIF}`} value={envDurum.AKTIF ?? 0} hint="Çalışır durumda" />
          <StatCard label={ENVANTER_DURUM_LABELS.BAKIMDA} value={envDurum.BAKIMDA ?? 0} hint="Bakım / onarımda" />
          <StatCard label={ENVANTER_DURUM_LABELS.ARIZALI} value={envDurum.ARIZALI ?? 0} hint="Arıza mevcut" />
          <StatCard label={ENVANTER_DURUM_LABELS.HURDAYA_AYRILDI} value={envDurum.HURDAYA_AYRILDI ?? 0} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className={sectionTitleCls}>Maliyetler</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Bakım kayıt" value={bakimToplam._count} />
          <StatCard label="Bakım maliyeti" value={`${bakimTL.toLocaleString("tr-TR")} ₺`} />
          <StatCard label="Yakıt" value={`${yakitLt.toLocaleString("tr-TR")} Lt`} hint={`${yakitTL.toLocaleString("tr-TR")} ₺`} />
          <StatCard
            label="Operasyon toplamı"
            value={`${operasyonTL.toLocaleString("tr-TR")} ₺`}
            hint="Bakım + yakıt"
            tone="navy"
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card padding={false}>
          <div className="p-5 pb-0">
            <CardHeader title="Müdürlük bazlı şikayet dağılımı" />
          </div>
          <DataTable framed={false} minWidth="640px" empty={mudurlukDagilim.length === 0}>
            <thead>
              <tr>
                <th>Müdürlük</th>
                <th className="!text-center">Toplam</th>
                <th className="!text-center">Açık</th>
                <th className="!text-center">Devam</th>
                <th className="!text-center">Kapatıldı</th>
                <th className="!text-center">Çok Acil</th>
                <th className="!text-center">Acil</th>
              </tr>
            </thead>
            <tbody>
              {mudurlukDagilim
                .filter((m) => m.name !== "Diğer" || m._count.complaints > 0)
                .map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td className="text-center font-semibold">{m._count.complaints}</td>
                    <td className="text-center text-kb-info">
                      {m.complaints.filter((c) => c.durum === "ACIK").length}
                    </td>
                    <td className="text-center text-kb-warning">
                      {m.complaints.filter((c) => c.durum === "DEVAM_EDIYOR").length}
                    </td>
                    <td className="text-center text-kb-success">
                      {m.complaints.filter((c) => c.durum === "KAPATILDI").length}
                    </td>
                    <td className="text-center text-kb-danger">
                      {m.complaints.filter((c) => c.oncelik === "COK_ACIL").length}
                    </td>
                    <td className="text-center text-kb-accent">
                      {m.complaints.filter((c) => c.oncelik === "ACIL").length}
                    </td>
                  </tr>
                ))}
            </tbody>
          </DataTable>
        </Card>

        <Card padding={false}>
          <div className="p-5 pb-0">
            <CardHeader title="Şikayet türü dağılımı" />
          </div>
          <DataTable framed={false} minWidth="420px" empty={turDagilim.length === 0}>
            <thead>
              <tr>
                <th>Tür</th>
                <th className="!text-center">Toplam</th>
                <th className="!text-center">Açık</th>
                <th className="!text-center">Kapatıldı</th>
              </tr>
            </thead>
            <tbody>
              {turDagilim.map((t) => (
                <tr key={t.name}>
                  <td>{t.name}</td>
                  <td className="text-center font-semibold">{t.complaints.length}</td>
                  <td className="text-center text-kb-info">
                    {t.complaints.filter((c) => c.durum === "ACIK").length}
                  </td>
                  <td className="text-center text-kb-success">
                    {t.complaints.filter((c) => c.durum === "KAPATILDI").length}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Card>
      </div>

      <Card padding={false}>
        <div className="p-5 pb-0">
          <CardHeader title="Son bakım kayıtları" description="En son girilen 10 kayıt" />
        </div>
        <DataTable
          framed={false}
          minWidth="480px"
          empty={yaklasanBakimlar.length === 0}
          emptyTitle="Henüz bakım kaydı yok"
          emptyDescription="Bakım takip ekranından yeni kayıt ekleyebilirsiniz."
        >
          <thead>
            <tr>
              <th>Plaka</th>
              <th>Araç</th>
              <th>Sonraki bakım</th>
            </tr>
          </thead>
          <tbody>
            {yaklasanBakimlar.map((b) => (
              <tr key={b.id}>
                <td className="font-mono font-medium">{b.vehicle.plaka}</td>
                <td>{b.vehicle.ad ?? "—"}</td>
                <td>
                  {b.sonrakiBakimTarihi
                    ? new Date(b.sonrakiBakimTarihi).toLocaleDateString("tr-TR")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Card>
    </div>
  );
}
