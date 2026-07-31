import {
  ENVANTER_DURUM_LABELS,
  GOREV_DURUM_LABELS,
  OPERASYON_DURUM_LABELS,
} from "@kars/shared";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ClipboardList,
  MessageCircle,
  Package,
  Wrench,
} from "lucide-react";
import { prisma } from "@kars/db";
import { auth } from "@/auth";
import { landingPathForRole } from "@/lib/nav";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { buttonCls, cardCls, sectionTitleCls } from "@/lib/ui";
import { departmentScope, requirePageAccess } from "@/lib/authz";
import { gorevBaslat, gorevKapat } from "@/lib/actions/tasks";
import { computeSlaSummary } from "@/lib/sla";
import { computeDashboard } from "@/lib/dashboard";
import { resolveRange, trDayKey } from "@/lib/dashboard-range";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { RangePicker } from "@/components/dashboard/RangePicker";
import { KB } from "@/components/charts/theme";
import {
  ComplaintTrendChart,
  CostTrendChart,
  DepartmentChart,
  SlaChart,
  TypeChart,
  VehicleStatusChart,
} from "@/components/dashboard/DashboardCharts";

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

/** Grafiklerin altındaki sayısal kırılımlar — varsayılan olarak kapalı. */
function DetailSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <details className={`${cardCls} group`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-semibold text-kb-ink">
        <span>
          {title}
          {description && (
            <span className="ml-2 font-normal text-kb-muted">{description}</span>
          )}
        </span>
        <span className="text-xs font-medium text-kb-navy group-open:hidden">
          Aç
        </span>
        <span className="hidden text-xs font-medium text-kb-navy group-open:inline">
          Kapat
        </span>
      </summary>
      <div className="border-t border-kb-border">{children}</div>
    </details>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageAccess("/");
  const session = await auth();
  if (!session) redirect("/giris");

  const role = session.user.role;
  const landing = landingPathForRole(role);
  if (role === "CALL_CENTER" && landing !== "/") {
    redirect(landing);
  }

  // ── Şoför / saha personeli: sade görev listesi ──────────────────────────
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
            <Link href="/gunluk-calisma" className={buttonCls("secondary")}>
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
              <Link
                href="/gorevler"
                className="text-sm font-semibold text-kb-navy underline"
              >
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
                        <SubmitButton
                          size="sm"
                          className="text-xs"
                          pendingLabel="Başlatılıyor…"
                        >
                          Başlat
                        </SubmitButton>
                      </form>
                    ) : (
                      <form
                        action={gorevKapat}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input type="hidden" name="id" value={g.id} />
                        <input type="hidden" name="durum" value="TAMAMLANDI" />
                        <SubmitButton
                          variant="secondary"
                          className="text-xs"
                          pendingLabel="Kapatılıyor…"
                        >
                          Kapat
                        </SubmitButton>
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

  // ── Yönetim görünümü ───────────────────────────────────────────────────
  const sp = await searchParams;
  const tek = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const range = resolveRange(tek(sp.aralik), tek(sp.bas), tek(sp.bit));

  const dept = departmentScope(session as never);
  const [data, sla] = await Promise.all([
    computeDashboard(session as never, range),
    computeSlaSummary(session as never),
  ]);

  const { kpi, anlik } = data;
  const kapsam =
    "departmentId" in dept ? "Müdürlüğünüze ait kayıtlar" : "Tüm müdürlükler";
  const araligiYaz = `${trDayKey(range.bas)} — ${trDayKey(range.bit)}`;

  const aracRenkleri: Record<string, string> = {
    MUSAIT: KB.success,
    GOREVDE: KB.info,
    BAKIMDA: KB.warning,
    ARIZALI: KB.danger,
    PLANLI_BAKIM: KB.muted,
  };
  // Grafik etiketlerinde emoji istemiyoruz
  const aracDurumAdi: Record<string, string> = {
    MUSAIT: "Müsait",
    GOREVDE: "Görevde",
    BAKIMDA: "Bakımda",
    ARIZALI: "Arızalı",
    PLANLI_BAKIM: "Planlı bakım",
  };

  const aracGrafik = Object.keys(aracDurumAdi).map((k) => ({
    name: aracDurumAdi[k],
    value: anlik.aracOperasyon[k] ?? 0,
    color: aracRenkleri[k],
  }));

  // Onaylayan rolü için WhatsApp onayı en öne alınır
  const acilKart = (
    <ActionCard
      key="acil"
      href="/sikayetler?sekme=aktif"
      title="Acil şikayet"
      count={anlik.acilSikayet}
      hint="Açık / devam · acil & çok acil"
      tone={anlik.acilSikayet > 0 ? "danger" : "navy"}
      icon={AlertTriangle}
    />
  );
  const whatsappKart = (
    <ActionCard
      key="whatsapp"
      href="/whatsapp"
      title="WhatsApp onay"
      count={anlik.onayBekleyenWhatsApp}
      hint="Onay bekleyen mesaj"
      tone={anlik.onayBekleyenWhatsApp > 0 ? "warning" : "navy"}
      icon={MessageCircle}
    />
  );
  const digerKartlar = [
    <ActionCard
      key="stok"
      href={
        anlik.kritikBeton > 0
          ? "/beton?tab=stok"
          : anlik.kritikBitum > 0
            ? "/bitum?tab=ozet"
            : "/malzeme-depo?tab=stok"
      }
      title="Kritik stok"
      count={anlik.kritikStokToplam}
      hint="Malzeme / beton / bitüm"
      tone={anlik.kritikStokToplam > 0 ? "danger" : "success"}
      icon={Package}
    />,
    <ActionCard
      key="bakim"
      href="/bakim"
      title="Yaklaşan bakım"
      count={anlik.yaklasanMuayene}
      hint="30 gün içinde muayene / sigorta / bakım"
      tone={anlik.yaklasanMuayene > 0 ? "warning" : "navy"}
      icon={Wrench}
    />,
    <ActionCard
      key="gorev"
      href="/gorevler?durum=DEVAM_EDIYOR"
      title="Devam eden görev"
      count={anlik.devamGorev}
      hint="Sahada devam eden işler"
      tone={anlik.devamGorev > 0 ? "warning" : "navy"}
      icon={ClipboardList}
    />,
  ];
  const aksiyonKartlari =
    role === "APPROVER"
      ? [whatsappKart, acilKart, ...digerKartlar]
      : [acilKart, whatsappKart, ...digerKartlar];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`${kapsam} · ${araligiYaz}`}
        actions={<RangePicker range={range} />}
      />

      <section className="space-y-3">
        <h2 className={sectionTitleCls}>
          Seçili dönem · önceki dönemle karşılaştırma
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard label="Yeni şikayet" delta={kpi.yeniSikayet} />
          <KpiCard label="Kapatılan şikayet" delta={kpi.kapatilanSikayet} />
          <KpiCard
            label="Ort. kapanış süresi"
            delta={kpi.ortKapanisGun}
            format="gun"
            dusukIyi
          />
          <KpiCard label="Tamamlanan görev" delta={kpi.tamamlananGorev} />
          <KpiCard
            label="Operasyon maliyeti"
            delta={kpi.operasyonMaliyeti}
            format="tl"
            dusukIyi
            hint="Bakım + yakıt"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className={sectionTitleCls}>Bugün yapılacaklar</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {aksiyonKartlari}
        </div>
      </section>

      <ComplaintTrendChart data={data.trend} />

      <div className="grid gap-6 lg:grid-cols-2">
        <DepartmentChart data={data.mudurlukDagilim} />
        <TypeChart data={data.turDagilim} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SlaChart
          data={{
            lt24h: sla.bucketLt24h,
            d1to3: sla.bucket1to3d,
            gt3d: sla.bucketGt3d,
          }}
        />
        <VehicleStatusChart data={aracGrafik} />
      </div>

      <CostTrendChart data={data.maliyetTrend} />

      <section className="space-y-3">
        <h2 className={sectionTitleCls}>Anlık durum</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Açık şikayet" value={anlik.acikSikayet} tone="navy" />
          <StatCard
            label="Devam eden"
            value={anlik.devamEdenSikayet}
            tone="warning"
          />
          <StatCard label="Çok acil" value={anlik.cokAcil} tone="danger" />
          <StatCard label="Acil" value={anlik.acil} tone="warning" />
          <StatCard
            label="Kritik stok"
            value={anlik.kritikStokToplam}
            tone={anlik.kritikStokToplam > 0 ? "danger" : "success"}
          />
          <StatCard
            label="Yaklaşan bakım"
            value={anlik.yaklasanMuayene}
            tone={anlik.yaklasanMuayene > 0 ? "warning" : "navy"}
          />
        </div>
        <p className="text-xs text-kb-muted">
          Detaylı SLA ve müdürlük KPI için{" "}
          <Link
            href="/raporlar"
            className="font-semibold text-kb-navy underline"
          >
            Raporlar
          </Link>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={sectionTitleCls}>Sayısal kırılımlar</h2>

        <DetailSection
          title="Müdürlük bazlı şikayet dağılımı"
          description={araligiYaz}
        >
          <DataTable
            framed={false}
            minWidth="640px"
            empty={data.mudurlukDagilim.length === 0}
            emptyTitle="Seçili dönemde şikayet yok"
          >
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
              {data.mudurlukDagilim.map((m) => (
                <tr key={m.id ?? "yok"}>
                  <td>{m.name}</td>
                  <td className="text-center font-semibold">{m.toplam}</td>
                  <td className="text-center text-kb-info">{m.acik}</td>
                  <td className="text-center text-kb-warning">{m.devam}</td>
                  <td className="text-center text-kb-success">{m.kapatildi}</td>
                  <td className="text-center text-kb-danger">{m.cokAcil}</td>
                  <td className="text-center text-kb-accent">{m.acil}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </DetailSection>

        <DetailSection title="Şikayet türü dağılımı" description={araligiYaz}>
          <DataTable
            framed={false}
            minWidth="420px"
            empty={data.turDagilim.length === 0}
            emptyTitle="Seçili dönemde şikayet yok"
          >
            <thead>
              <tr>
                <th>Tür</th>
                <th className="!text-center">Toplam</th>
                <th className="!text-center">Açık</th>
                <th className="!text-center">Kapatıldı</th>
              </tr>
            </thead>
            <tbody>
              {data.turDagilim.map((t) => (
                <tr key={t.name}>
                  <td>{t.name}</td>
                  <td className="text-center font-semibold">{t.toplam}</td>
                  <td className="text-center text-kb-info">{t.acik}</td>
                  <td className="text-center text-kb-success">{t.kapatildi}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </DetailSection>

        <DetailSection title="Araç envanteri" description="Anlık durum">
          <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
            <StatCard
              label={`Envanter: ${ENVANTER_DURUM_LABELS.AKTIF}`}
              value={anlik.aracEnvanter.AKTIF ?? 0}
              hint="Çalışır durumda"
            />
            <StatCard
              label={ENVANTER_DURUM_LABELS.BAKIMDA}
              value={anlik.aracEnvanter.BAKIMDA ?? 0}
              hint="Bakım / onarımda"
            />
            <StatCard
              label={ENVANTER_DURUM_LABELS.ARIZALI}
              value={anlik.aracEnvanter.ARIZALI ?? 0}
              hint="Arıza mevcut"
            />
            <StatCard
              label={ENVANTER_DURUM_LABELS.HURDAYA_AYRILDI}
              value={anlik.aracEnvanter.HURDAYA_AYRILDI ?? 0}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 px-4 pb-4 md:grid-cols-3 lg:grid-cols-5">
            {(
              Object.keys(OPERASYON_DURUM_LABELS) as Array<
                keyof typeof OPERASYON_DURUM_LABELS
              >
            ).map((k) => (
              <StatCard
                key={k}
                label={OPERASYON_DURUM_LABELS[k]}
                value={anlik.aracOperasyon[k] ?? 0}
              />
            ))}
          </div>
        </DetailSection>

        <DetailSection
          title="Son bakım kayıtları"
          description="En son girilen 10 kayıt"
        >
          <DataTable
            framed={false}
            minWidth="480px"
            empty={data.sonBakimlar.length === 0}
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
              {data.sonBakimlar.map((b) => (
                <tr key={b.id}>
                  <td className="font-mono font-medium">{b.plaka}</td>
                  <td>{b.ad ?? "—"}</td>
                  <td>
                    {b.sonrakiBakimTarihi
                      ? new Date(b.sonrakiBakimTarihi).toLocaleDateString("tr-TR")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </DetailSection>
      </section>
    </div>
  );
}
