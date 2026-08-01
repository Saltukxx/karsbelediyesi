/**
 * Panelin `--kb-*` tasarım token'larının grafik karşılıkları.
 *
 * ECharts canvas'a çizdiği için CSS değişkenlerini okuyamaz; token değerleri
 * burada birebir tekrarlanır. `globals.css` değişirse burası da güncellenmeli.
 */
export const KB = {
  navy: "#1e3a5f",
  navyDeep: "#152a45",
  navySoft: "#2a4a73",
  accent: "#c45c26",
  border: "#d8dee6",
  muted: "#5c6b7a",
  ink: "#1a2332",
  success: "#1f6b4a",
  warning: "#9a6700",
  danger: "#b42318",
  info: "#175cd3",
  surface: "#f4f6f8",
} as const;

/** Kategorik seriler için varsayılan sıra */
export const SERIES_COLORS = [
  KB.navy,
  KB.accent,
  KB.success,
  KB.info,
  KB.warning,
  KB.danger,
  KB.navySoft,
  KB.muted,
] as const;

/**
 * Canvas, CSS değişkenlerini çözemez ve next/font aile adlarını hash'ler;
 * gerçek aile adı bu yüzden çalışma anında `<body>` üzerindeki değişkenden
 * okunur. Sunucu tarafında (SSR) grafik çizilmediği için fallback yeterli.
 */
function cssFont(varName: string, fallback: string): string {
  if (typeof document === "undefined" || !document.body) return fallback;
  const v = getComputedStyle(document.body).getPropertyValue(varName).trim();
  return v ? `${v}, ${fallback}` : fallback;
}

export const FONT_FAMILY = cssFont(
  "--font-source-sans",
  '"Source Sans 3", system-ui, sans-serif',
);

export function serifFamily(): string {
  return cssFont("--font-source-serif", '"Source Serif 4", Georgia, serif');
}

/** Alan grafikleri için aşağı doğru şeffaflaşan dikey gradyan. */
export function dikeyGradyan(rgb: string, tavan = 0.18) {
  return {
    type: "linear" as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: `rgba(${rgb},${tavan})` },
      { offset: 1, color: `rgba(${rgb},0)` },
    ],
  };
}

/** Donut ortasına serif toplam yazısı (ECharts title bileşeniyle). */
export function donutOrtasi(toplam: number, etiket: string, sol = "32%") {
  return {
    text: formatTr(toplam),
    subtext: etiket,
    left: sol,
    top: "40%",
    textAlign: "center" as const,
    textStyle: {
      fontFamily: serifFamily(),
      fontSize: 26,
      fontWeight: 600 as const,
      color: KB.ink,
    },
    subtextStyle: {
      fontFamily: FONT_FAMILY,
      fontSize: 11,
      color: KB.muted,
    },
  };
}

const axisLabel = {
  color: KB.muted,
  fontSize: 11,
  fontFamily: FONT_FAMILY,
};

/** Tüm grafiklerde ortak taban ayarlar. */
export const baseOption = {
  color: [...SERIES_COLORS],
  textStyle: { fontFamily: FONT_FAMILY, color: KB.ink },
  grid: { left: 8, right: 12, top: 28, bottom: 4, containLabel: true },
  tooltip: {
    backgroundColor: "#ffffff",
    borderColor: KB.border,
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: KB.ink, fontSize: 12, fontFamily: FONT_FAMILY },
    extraCssText: "box-shadow: 0 8px 24px rgba(21,42,69,0.16); border-radius: 8px;",
  },
  legend: {
    icon: "roundRect",
    itemWidth: 10,
    itemHeight: 10,
    textStyle: { color: KB.muted, fontSize: 11, fontFamily: FONT_FAMILY },
  },
} as const;

export const categoryAxis = {
  type: "category" as const,
  axisLabel,
  axisLine: { lineStyle: { color: KB.border } },
  axisTick: { show: false },
};

export const valueAxis = {
  type: "value" as const,
  axisLabel,
  axisLine: { show: false },
  splitLine: { lineStyle: { color: KB.border, type: "dashed" as const } },
};

/** Sayıları Türkçe biçimde gösterir (grafik etiketleri için). */
export function formatTr(value: number): string {
  return value.toLocaleString("tr-TR");
}

export function formatTL(value: number): string {
  return `${Math.round(value).toLocaleString("tr-TR")} ₺`;
}
