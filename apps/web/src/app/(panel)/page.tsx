import { Suspense } from "react";
import {
  ENVANTER_DURUM_LABELS,
  GOREV_DURUM_LABELS,
  KANAL_LABELS,
  OPERASYON_DURUM_LABELS,
} from "@kars/shared";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ChevronRight,
  ClipboardList,
  Clock,
  Flame,
  MessageCircle,
  Package,
  Siren,
  Wrench,
} from "lucide-react";
import { prisma } from "@kars/db";
import { landingPathForRole } from "@/lib/nav";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { StatCard } from "@/components/ui/StatCard";
import { SectionTitle } from "@/components/ui/SectionTitle";
import {
  buttonCls,
  cardCls,
  cardInteractiveCls,
  numeralCls,
  toneChipCls,
  type Tone,
} from "@/lib/ui";
import {
  departmentScope,
  requirePageAccess,
  type AppSession,
} from "@/lib/authz";
import { gorevBaslat, gorevKapat } from "@/lib/actions/tasks";
import { computeSlaSummary } from "@/lib/sla";
import { computeDashboard } from "@/lib/dashboard";
import {
  resolveRange,
  trDayKey,
  type DashboardRange,
} from "@/lib/dashboard-range";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { RangePicker } from "@/components/dashboard/RangePicker";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { KB } from "@/components/charts/theme";
import {
  ChannelChart,
  ComplaintHeatMapCard,
  ComplaintTrendChart,
  CostTrendChart,
  DepartmentChart,
  HourHeatmapChart,
  NeighborhoodChart,
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
  tone?: Tone;
  icon: typeof AlertTriangle;
}) {
  return (
    <Link
      href={href}
      className={`${cardInteractiveCls} group flex items-start gap-3 p-4`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${toneChipCls[tone]}`}
      >
        <Icon className="h-[1.05rem] w-[1.05rem]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className={`${numeralCls} text-xl font-semibold text-kb-ink`}>
          {count.toLocaleString("tr-TR")}
        </div>
        <div className="truncate text-[0.8rem] font-medium text-kb-ink">
          {title}
        </div>
        <div className="mt-0.5 truncate text-xs text-kb-muted">{hint}</div>
      </div>
      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-kb-muted/60 transition-transform group-hover:translate-x-0.5 group-hover:text-kb-navy" />
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
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
        <ChevronRight className="h-4 w-4 shrink-0 text-kb-muted transition-transform group-open:rotate-90" />
        <span className="font-brand text-[0.9rem] font-semibold text-kb-ink">
          {title}
          {description && (
            <span className="ml-2 font-sans text-[0.8rem] font-normal text-kb-muted">
              {description}
            </span>
          )}
        </span>
      </summary>
      <div className="border-t border-kb-border">{children}</div>
    </details>
  );
}

// ── Şoför / saha personeli: sade görev listesi ────────────────────────────

async function SahaGorunumu({ userId }: { userId: string }) {
  const myTasks = await prisma.vehicleTask.findMany({
    where: {
      driverId: userId,
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

// ── Yönetim görünümü ──────────────────────────────────────────────────────

/**
 * Veri bekleyen gövde. Sayfa kabuğundan ayrı tutulur ki tarih aralığı
 * değiştiğinde Suspense sınırı yeniden askıya alınsın ve iskelet anında
 * görünsün.
 */
async function DashboardContent({
  session,
  range,
}: {
  session: AppSession;
  range: DashboardRange;
}) {
  const [data, sla] = await Promise.all([
    computeDashboard(session, range),
    computeSlaSummary(session),
  ]);

  const { kpi, anlik } = data;
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
    session.user.role === "APPROVER"
      ? [whatsappKart, acilKart, ...digerKartlar]
      : [acilKart, whatsappKart, ...digerKartlar];

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionTitle description="önceki dönemle karşılaştırma">
          Seçili dönem
        </SectionTitle>
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
            hint="bakım + yakıt"
          />
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle description="doğrudan ilgili ekrana gider">
          Bugün yapılacaklar
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {aksiyonKartlari}
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle description={araligiYaz}>Eğilimler</SectionTitle>

        <ComplaintTrendChart data={data.trend} />

        <div className="grid gap-4 lg:grid-cols-2">
          <DepartmentChart data={data.mudurlukDagilim} />
          <TypeChart data={data.turDagilim} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SlaChart
            data={{
              lt24h: sla.bucketLt24h,
              d1to3: sla.bucket1to3d,
              gt3d: sla.bucketGt3d,
            }}
          />
          <VehicleStatusChart data={aracGrafik} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChannelChart
            data={data.kanalDagilim.map((k) => ({
              name:
                KANAL_LABELS[k.kanal as keyof typeof KANAL_LABELS] ?? k.kanal,
              value: k.toplam,
            }))}
          />
          <NeighborhoodChart data={data.mahalleDagilim} />
        </div>

        <ComplaintHeatMapCard points={data.sikayetKonumlari} />

        <HourHeatmapChart data={data.saatlikYogunluk} />

        <CostTrendChart data={data.maliyetTrend} />
      </section>

      <section className="space-y-3">
        <SectionTitle
          description="tarih aralığından bağımsız"
          action={
            <Link
              href="/raporlar"
              className="text-[0.8rem] font-semibold text-kb-navy hover:underline"
            >
              Detaylı raporlar
            </Link>
          }
        >
          Anlık durum
        </SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <StatCard
            label="Açık şikayet"
            value={anlik.acikSikayet}
            tone="info"
            icon={Siren}
          />
          <StatCard
            label="Devam eden"
            value={anlik.devamEdenSikayet}
            tone="warning"
            icon={Clock}
          />
          <StatCard
            label="Çok acil"
            value={anlik.cokAcil}
            tone={anlik.cokAcil > 0 ? "danger" : "neutral"}
            icon={Flame}
          />
          <StatCard
            label="Acil"
            value={anlik.acil}
            tone={anlik.acil > 0 ? "warning" : "neutral"}
            icon={AlertTriangle}
          />
          <StatCard
            label="Kritik stok"
            value={anlik.kritikStokToplam}
            tone={anlik.kritikStokToplam > 0 ? "danger" : "success"}
            icon={Package}
          />
          <StatCard
            label="Yaklaşan bakım"
            value={anlik.yaklasanMuayene}
            tone={anlik.yaklasanMuayene > 0 ? "warning" : "neutral"}
            icon={Wrench}
          />
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle description="grafiklerin arkasındaki sayılar">
          Sayısal kırılımlar
        </SectionTitle>

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

        <DetailSection title="Araç envanteri" description="anlık durum">
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
          description="en son girilen 10 kayıt"
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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePageAccess("/");

  const role = session.user.role;
  const landing = landingPathForRole(role);
  if (role === "CALL_CENTER" && landing !== "/") {
    redirect(landing);
  }

  if (role === "DRIVER" || role === "FIELD_WORKER") {
    return <SahaGorunumu userId={session.user.id} />;
  }

  const sp = await searchParams;
  const tek = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const aralik = tek(sp.aralik);
  const bas = tek(sp.bas);
  const bit = tek(sp.bit);
  const range = resolveRange(aralik, bas, bit);

  const dept = departmentScope(session);
  const kapsam =
    "departmentId" in dept ? "Müdürlüğünüze ait kayıtlar" : "Tüm müdürlükler";

  // Suspense anahtarı arama parametrelerine bağlı: aralık değişince sınır
  // yeniden askıya alınır ve iskelet tıklama anında ekrana gelir.
  const suspenseKey = `${aralik ?? ""}|${bas ?? ""}|${bit ?? ""}`;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={`${kapsam} · ${trDayKey(range.bas)} — ${trDayKey(range.bit)}`}
        actions={<RangePicker range={range} />}
      />
      <Suspense key={suspenseKey} fallback={<DashboardSkeleton />}>
        <DashboardContent session={session} range={range} />
      </Suspense>
    </div>
  );
}
