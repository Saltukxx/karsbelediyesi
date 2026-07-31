"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import { baseOption } from "./theme";

/**
 * Yalnız kullanılan modüller kaydedilir; `echarts` paketinin tamamı yerine
 * bu alt küme bundle'a girer.
 */
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

/**
 * ECharts örneğini yönetir: mount'ta kurar, seçenek değişince günceller,
 * kapsayıcı boyutu değişince yeniden ölçekler, unmount'ta serbest bırakır.
 */
export function EChart({
  option,
  height = 280,
  className = "",
  ariaLabel,
}: {
  option: EChartsOption;
  height?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const chart = echarts.init(host, undefined, { renderer: "canvas" });
    chartRef.current = chart;

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(host);

    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption({ ...baseOption, ...option } as EChartsOption, {
      notMerge: true,
    });
  }, [option]);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={ariaLabel}
      style={{ height }}
      className={`w-full ${className}`}
    />
  );
}
