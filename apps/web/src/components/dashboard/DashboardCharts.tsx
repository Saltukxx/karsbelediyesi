"use client";

import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
import { BarChart3 } from "lucide-react";
import {
  categoryAxis,
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
        areaStyle: { color: "rgba(30,58,95,0.10)" },
      },
      {
        name: "Kapanan",
        type: "line",
        smooth: true,
        showSymbol: false,
        data: data.map((d) => d.kapanan),
        lineStyle: { width: 2, color: KB.success },
        itemStyle: { color: KB.success },
        areaStyle: { color: "rgba(31,107,74,0.10)" },
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
        itemStyle: { color: KB.success },
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

  const option: EChartsOption = {
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
        radius: ["48%", "72%"],
        center: ["32%", "50%"],
        avoidLabelOverlap: true,
        label: { show: false },
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
  const kategoriler = ["24 saatten az", "1–3 gün", "3 günden fazla"];
  const degerler = [data.lt24h, data.d1to3, data.gt3d];
  const renkler = [KB.success, KB.warning, KB.danger];

  const option: EChartsOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 8, right: 24, top: 16, bottom: 4, containLabel: true },
    xAxis: { ...valueAxis, minInterval: 1 },
    yAxis: { ...categoryAxis, data: kategoriler },
    series: [
      {
        type: "bar",
        data: degerler.map((v, i) => ({
          value: v,
          itemStyle: { color: renkler[i] },
        })),
        barMaxWidth: 26,
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
      title="Açık şikayet bekleme süresi"
      description="Şu an açık ve devam eden şikayetlerin yaşı"
      empty={degerler.every((v) => v === 0)}
      emptyText="Açık şikayet yok"
    >
      <EChart option={option} height={200} ariaLabel="SLA bekleme süresi dağılımı" />
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
        itemStyle: { color: KB.accent },
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

// ── Araç durumu ──────────────────────────────────────────────────────────

export function VehicleStatusChart({
  data,
}: {
  data: Array<{ name: string; value: number; color: string }>;
}) {
  const dolu = data.filter((d) => d.value > 0);

  const option: EChartsOption = {
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
        radius: ["48%", "72%"],
        center: ["32%", "50%"],
        label: { show: false },
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
