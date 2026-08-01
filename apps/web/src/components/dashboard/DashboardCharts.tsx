"use client";

import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
import { BarChart3 } from "lucide-react";
import {
  categoryAxis,
  dikeyGradyan,
  donutOrtasi,
  formatTL,
  formatTr,
  KB,
  valueAxis,
} from "@/components/charts/theme";
import { formatDayLabel, formatMonthLabel } from "@/lib/dashboard-range";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * ECharts canvas'a çizer ve yalnız tarayıcıda çalışır; sunucu render'ına
 * sokulmaması için dinamik yüklenir.
 */
const EChart = dynamic(
  () => import("@/components/charts/EChart").then((m) => m.EChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[280px] w-full animate-pulse rounded bg-kb-border/40" />
    ),
  },
);

// Leaflet, window'a bağımlı; sunucu render'ına girmemesi için dinamik yüklenir
const ComplaintHeatMap = dynamic(
  () => import("@/components/dashboard/ComplaintHeatMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[380px] w-full animate-pulse rounded bg-kb-border/40" />
    ),
  },
);

/**
 * Veri yokken grafik yüksekliği rezerve edilmez; kart kendi kadar yer kaplar.
 * Aksi halde boş bir dashboard baştan aşağı ölü alanla dolar.
 */
function ChartCard({
  title,
  description,
  action,
  empty,
  emptyText = "Seçili dönemde veri yok",
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  empty?: boolean;
  emptyText?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader
        title={title}
        description={description}
        action={action}
        divider
      />
      {empty ? (
        <EmptyState compact title={emptyText} icon={BarChart3} />
      ) : (
        children
      )}
    </Card>
  );
}

// ── Şikayet trendi ───────────────────────────────────────────────────────

export function ComplaintTrendChart({
  data,
}: {
  data: Array<{ gun: string; acilan: number; kapanan: number }>;
}) {
  const bosVeri = data.every((d) => d.acilan === 0 && d.kapanan === 0);

  const option: EChartsOption = {
    tooltip: { trigger: "axis" },
    legend: { data: ["Açılan", "Kapanan"], right: 0, top: 0 },
    grid: { left: 8, right: 12, top: 32, bottom: 4, containLabel: true },
    xAxis: {
      ...categoryAxis,
      data: data.map((d) => formatDayLabel(d.gun)),
      boundaryGap: false,
    },
    yAxis: { ...valueAxis, minInterval: 1 },
    series: [
      {
        name: "Açılan",
        type: "line",
        smooth: true,
        showSymbol: false,
        data: data.map((d) => d.acilan),
        lineStyle: { width: 2, color: KB.navy },
        itemStyle: { color: KB.navy },
        areaStyle: { color: dikeyGradyan("30,58,95") },
        // Dönem ortalaması: "bugün normalin üstünde mi" sorusunu anında cevaplar
        markLine: {
          silent: true,
          symbol: "none",
          precision: 1,
          lineStyle: { type: "dashed", color: KB.muted, width: 1 },
          label: {
            position: "insideEndTop",
            color: KB.muted,
            fontSize: 10,
            formatter: "ort. {c}",
          },
          data: [{ type: "average" }],
        },
      },
      {
        name: "Kapanan",
        type: "line",
        smooth: true,
        showSymbol: false,
        data: data.map((d) => d.kapanan),
        lineStyle: { width: 2, color: KB.success },
        itemStyle: { color: KB.success },
        areaStyle: { color: dikeyGradyan("31,107,74", 0.14) },
      },
    ],
  };

  return (
    <ChartCard
      title="Şikayet trendi"
      description="Seçili dönemde günlük açılan ve kapanan şikayet"
      empty={bosVeri}
    >
      <EChart option={option} height={280} ariaLabel="Günlük şikayet trendi" />
    </ChartCard>
  );
}

// ── Müdürlük dağılımı ────────────────────────────────────────────────────

export function DepartmentChart({
  data,
}: {
  data: Array<{
    name: string;
    acik: number;
    devam: number;
    kapatildi: number;
  }>;
}) {
  // Yatay bar: en çok şikayet alan müdürlükler üstte görünsün
  const top = data.slice(0, 8).reverse();

  const option: EChartsOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { data: ["Açık", "Devam eden", "Kapatıldı"], right: 0, top: 0 },
    grid: { left: 8, right: 16, top: 32, bottom: 4, containLabel: true },
    xAxis: { ...valueAxis, minInterval: 1 },
    yAxis: {
      ...categoryAxis,
      data: top.map((d) => d.name),
      axisLabel: { ...categoryAxis.axisLabel, width: 130, overflow: "truncate" },
    },
    series: [
      {
        name: "Açık",
        type: "bar",
        stack: "toplam",
        data: top.map((d) => d.acik),
        itemStyle: { color: KB.info },
        barMaxWidth: 22,
      },
      {
        name: "Devam eden",
        type: "bar",
        stack: "toplam",
        data: top.map((d) => d.devam),
        itemStyle: { color: KB.warning },
        barMaxWidth: 22,
      },
      {
        name: "Kapatıldı",
        type: "bar",
        stack: "toplam",
        data: top.map((d) => d.kapatildi),
        itemStyle: { color: KB.success, borderRadius: [0, 3, 3, 0] },
        barMaxWidth: 22,
      },
    ],
  };

  return (
    <ChartCard
      title="Müdürlük bazlı dağılım"
      description="En çok şikayet alan 8 müdürlük"
      empty={data.length === 0}
    >
      <EChart
        option={option}
        height={Math.max(220, top.length * 34 + 60)}
        ariaLabel="Müdürlük bazlı şikayet dağılımı"
      />
    </ChartCard>
  );
}

// ── Şikayet türü dağılımı ────────────────────────────────────────────────

export function TypeChart({
  data,
}: {
  data: Array<{ name: string; toplam: number }>;
}) {
  const top = data.slice(0, 7);
  const kalan = data.slice(7).reduce((a, d) => a + d.toplam, 0);
  const dilimler = kalan > 0 ? [...top, { name: "Diğer", toplam: kalan }] : top;
  const toplam = data.reduce((a, d) => a + d.toplam, 0);

  const option: EChartsOption = {
    title: donutOrtasi(toplam, "şikayet"),
    tooltip: {
      trigger: "item",
      formatter: (p) => {
        const params = p as { name: string; value: number; percent?: number };
        return `${params.name}<br/><b>${formatTr(params.value)}</b> (%${params.percent ?? 0})`;
      },
    },
    legend: { orient: "vertical", right: 0, top: "center", itemGap: 8 },
    series: [
      {
        type: "pie",
        radius: ["52%", "72%"],
        center: ["32%", "50%"],
        avoidLabelOverlap: true,
        label: { show: false },
        itemStyle: { borderColor: "#ffffff", borderWidth: 2 },
        data: dilimler.map((d) => ({ name: d.name, value: d.toplam })),
      },
    ],
  };

  return (
    <ChartCard
      title="Şikayet türü dağılımı"
      description="Seçili dönemde kayda giren şikayetler"
      empty={data.length === 0}
    >
      <EChart option={option} height={280} ariaLabel="Şikayet türü dağılımı" />
    </ChartCard>
  );
}

// ── SLA dağılımı ─────────────────────────────────────────────────────────

export function SlaChart({
  data,
}: {
  data: { lt24h: number; d1to3: number; gt3d: number };
}) {
  // Tek %100 şerit: oran bir bakışta okunur, üç ayrı bardan daha az yer kaplar
  const dilimler = [
    { ad: "24 saatten az", deger: data.lt24h, renk: KB.success },
    { ad: "1–3 gün", deger: data.d1to3, renk: KB.warning },
    { ad: "3 günden fazla", deger: data.gt3d, renk: KB.danger },
  ];
  const toplam = dilimler.reduce((a, d) => a + d.deger, 0);

  const option: EChartsOption = {
    tooltip: {
      trigger: "item",
      formatter: (p) => {
        const params = p as { seriesName: string; value: number };
        const oran = toplam > 0 ? Math.round((params.value / toplam) * 100) : 0;
        return `${params.seriesName}<br/><b>${formatTr(params.value)}</b> şikayet (%${oran})`;
      },
    },
    legend: { data: dilimler.map((d) => d.ad), right: 0, top: 0 },
    grid: { left: 8, right: 8, top: 36, bottom: 4, containLabel: true },
    xAxis: { ...valueAxis, max: toplam, show: false },
    yAxis: { ...categoryAxis, data: [""], show: false },
    series: dilimler.map((d, i) => ({
      name: d.ad,
      type: "bar" as const,
      stack: "yas",
      data: [d.deger],
      itemStyle: {
        color: d.renk,
        borderColor: "#ffffff",
        borderWidth: d.deger > 0 ? 1 : 0,
        borderRadius:
          i === 0 ? [3, 0, 0, 3] : i === dilimler.length - 1 ? [0, 3, 3, 0] : 0,
      },
      barMaxWidth: 34,
      label: {
        show: true,
        color: "#ffffff",
        fontSize: 11,
        fontWeight: 600,
        formatter: (p: unknown) => {
          const v = (p as { value: number }).value;
          return v > 0 ? formatTr(v) : "";
        },
      },
    })),
  };

  return (
    <ChartCard
      title="Açık şikayet bekleme süresi"
      description="Şu an açık ve devam eden şikayetlerin yaşı"
      empty={toplam === 0}
      emptyText="Açık şikayet yok"
    >
      <EChart option={option} height={110} ariaLabel="SLA bekleme süresi dağılımı" />
    </ChartCard>
  );
}

// ── Maliyet trendi ───────────────────────────────────────────────────────

export function CostTrendChart({
  data,
}: {
  data: Array<{ ay: string; bakim: number; yakit: number }>;
}) {
  const option: EChartsOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (p) => {
        const rows = p as unknown as Array<{
          axisValue: string;
          seriesName: string;
          value: number;
          marker: string;
        }>;
        const toplam = rows.reduce((a, r) => a + (r.value ?? 0), 0);
        const satirlar = rows
          .map((r) => `${r.marker} ${r.seriesName}: <b>${formatTL(r.value ?? 0)}</b>`)
          .join("<br/>");
        return `${rows[0]?.axisValue ?? ""}<br/>${satirlar}<br/>Toplam: <b>${formatTL(toplam)}</b>`;
      },
    },
    legend: { data: ["Bakım", "Yakıt"], right: 0, top: 0 },
    grid: { left: 8, right: 12, top: 32, bottom: 4, containLabel: true },
    xAxis: { ...categoryAxis, data: data.map((d) => formatMonthLabel(d.ay)) },
    yAxis: {
      ...valueAxis,
      axisLabel: {
        ...valueAxis.axisLabel,
        formatter: (v: number) =>
          v >= 1000 ? `${Math.round(v / 1000)}b` : String(v),
      },
    },
    series: [
      {
        name: "Bakım",
        type: "bar",
        stack: "maliyet",
        data: data.map((d) => d.bakim),
        itemStyle: { color: KB.navy },
        barMaxWidth: 40,
      },
      {
        name: "Yakıt",
        type: "bar",
        stack: "maliyet",
        data: data.map((d) => d.yakit),
        itemStyle: { color: KB.accent, borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 40,
      },
    ],
  };

  return (
    <ChartCard
      title="Operasyon maliyeti"
      description="Aylık bakım ve yakıt gideri"
      empty={data.length === 0}
    >
      <EChart option={option} height={260} ariaLabel="Aylık operasyon maliyeti" />
    </ChartCard>
  );
}

// ── Kanal dağılımı ───────────────────────────────────────────────────────

export function ChannelChart({
  data,
}: {
  data: Array<{ name: string; value: number }>;
}) {
  const toplam = data.reduce((a, d) => a + d.value, 0);
  // Kanal sayısı az ve sabit; renkler tutarlı kalsın diye ada göre atanır
  const renkByAd: Record<string, string> = {
    Telefon: KB.navy,
    WhatsApp: KB.success,
    Web: KB.info,
  };

  const option: EChartsOption = {
    title: donutOrtasi(toplam, "şikayet"),
    tooltip: {
      trigger: "item",
      formatter: (p) => {
        const params = p as { name: string; value: number; percent?: number };
        return `${params.name}<br/><b>${formatTr(params.value)}</b> (%${params.percent ?? 0})`;
      },
    },
    legend: { orient: "vertical", right: 0, top: "center", itemGap: 8 },
    series: [
      {
        type: "pie",
        radius: ["52%", "72%"],
        center: ["32%", "50%"],
        label: { show: false },
        itemStyle: { borderColor: "#ffffff", borderWidth: 2 },
        data: data.map((d) => ({
          name: d.name,
          value: d.value,
          itemStyle: renkByAd[d.name] ? { color: renkByAd[d.name] } : undefined,
        })),
      },
    ],
  };

  return (
    <ChartCard
      title="Kanal dağılımı"
      description="Şikayetler hangi kanaldan geliyor"
      empty={toplam === 0}
    >
      <EChart option={option} height={240} ariaLabel="Şikayet kanal dağılımı" />
    </ChartCard>
  );
}

// ── Mahalle yoğunluğu ────────────────────────────────────────────────────

export function NeighborhoodChart({
  data,
}: {
  data: Array<{ name: string; toplam: number }>;
}) {
  // Yatay bar: en yoğun mahalle en üstte
  const siralanmis = [...data].reverse();

  const option: EChartsOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 8, right: 32, top: 8, bottom: 4, containLabel: true },
    xAxis: { ...valueAxis, minInterval: 1 },
    yAxis: {
      ...categoryAxis,
      data: siralanmis.map((d) => d.name),
      axisLabel: { ...categoryAxis.axisLabel, width: 130, overflow: "truncate" },
    },
    series: [
      {
        type: "bar",
        data: siralanmis.map((d) => d.toplam),
        itemStyle: { color: KB.navy, borderRadius: [0, 3, 3, 0] },
        barMaxWidth: 18,
        label: {
          show: true,
          position: "right",
          color: KB.muted,
          fontSize: 11,
          formatter: (p) => formatTr((p as { value: number }).value),
        },
      },
    ],
  };

  return (
    <ChartCard
      title="Mahalle yoğunluğu"
      description="Seçili dönemde en çok şikayet üreten 10 mahalle"
      empty={data.length === 0}
    >
      <EChart
        option={option}
        height={Math.max(180, siralanmis.length * 30 + 40)}
        ariaLabel="Mahalle bazlı şikayet yoğunluğu"
      />
    </ChartCard>
  );
}

// ── Şikayet yoğunluk haritası ────────────────────────────────────────────

export function ComplaintHeatMapCard({
  points,
}: {
  points: Array<[number, number]>;
}) {
  return (
    <ChartCard
      title="Şikayet yoğunluk haritası"
      description="Seçili dönemde konumu girilen şikayetlerin coğrafi dağılımı"
      empty={points.length === 0}
      emptyText="Konumu girilmiş şikayet yok"
    >
      <ComplaintHeatMap points={points} />
    </ChartCard>
  );
}

// ── Saatlik yoğunluk ısı haritası ────────────────────────────────────────

const HAFTA_GUNLERI = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export function HourHeatmapChart({
  data,
}: {
  data: Array<{ haftaGunu: number; saat: number; adet: number }>;
}) {
  const enYuksek = data.reduce((a, d) => Math.max(a, d.adet), 0);
  const saatler = Array.from({ length: 24 }, (_, i) => `${i}:00`);
  // Isı haritasında y ekseni alttan yukarı gider; Pazartesi üstte dursun
  const gunler = [...HAFTA_GUNLERI].reverse();

  const option: EChartsOption = {
    tooltip: {
      formatter: (p) => {
        const params = p as unknown as { value: [number, number, number] };
        const [saat, gunIdx, adet] = params.value;
        return `${gunler[gunIdx]} ${saat}:00–${saat + 1}:00<br/><b>${formatTr(adet)}</b> şikayet`;
      },
    },
    grid: { left: 8, right: 8, top: 8, bottom: 40, containLabel: true },
    xAxis: {
      ...categoryAxis,
      data: saatler,
      axisLabel: { ...categoryAxis.axisLabel, interval: 2 },
      splitArea: { show: true },
    },
    yAxis: { ...categoryAxis, data: gunler, splitArea: { show: true } },
    visualMap: {
      min: 0,
      max: Math.max(enYuksek, 1),
      calculable: false,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      itemHeight: 90,
      textStyle: { color: KB.muted, fontSize: 10 },
      inRange: { color: ["#eef2f6", "#b9c8dd", KB.navy] },
    },
    series: [
      {
        type: "heatmap",
        data: data.map((d) => [
          d.saat,
          gunler.indexOf(HAFTA_GUNLERI[d.haftaGunu - 1] ?? ""),
          d.adet,
        ]),
        itemStyle: { borderColor: "#ffffff", borderWidth: 1 },
        emphasis: { itemStyle: { shadowBlur: 6, shadowColor: "rgba(21,42,69,0.3)" } },
      },
    ],
  };

  return (
    <ChartCard
      title="Saatlik yoğunluk"
      description="Şikayetler haftanın hangi günü, günün hangi saatinde geliyor"
      empty={data.length === 0}
    >
      <EChart option={option} height={240} ariaLabel="Gün ve saat bazlı şikayet yoğunluğu" />
    </ChartCard>
  );
}

// ── Araç durumu ──────────────────────────────────────────────────────────

export function VehicleStatusChart({
  data,
}: {
  data: Array<{ name: string; value: number; color: string }>;
}) {
  const dolu = data.filter((d) => d.value > 0);
  const toplam = dolu.reduce((a, d) => a + d.value, 0);

  const option: EChartsOption = {
    title: donutOrtasi(toplam, "araç"),
    tooltip: {
      trigger: "item",
      formatter: (p) => {
        const params = p as { name: string; value: number; percent?: number };
        return `${params.name}<br/><b>${formatTr(params.value)}</b> araç (%${params.percent ?? 0})`;
      },
    },
    legend: { orient: "vertical", right: 0, top: "center", itemGap: 8 },
    series: [
      {
        type: "pie",
        radius: ["52%", "72%"],
        center: ["32%", "50%"],
        label: { show: false },
        itemStyle: { borderColor: "#ffffff", borderWidth: 2 },
        data: dolu.map((d) => ({
          name: d.name,
          value: d.value,
          itemStyle: { color: d.color },
        })),
      },
    ],
  };

  return (
    <ChartCard
      title="Araç operasyon durumu"
      description="Filonun anlık dağılımı"
      empty={dolu.length === 0}
      emptyText="Kayıtlı araç yok"
    >
      <EChart option={option} height={240} ariaLabel="Araç operasyon durumu dağılımı" />
    </ChartCard>
  );
}
