"use client";

import dynamic from "next/dynamic";
import type { TrackReportData } from "@/components/map/track-report-types";

const TrackReportMap = dynamic(() => import("@/components/map/TrackReportMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[60vh] min-h-[420px] items-center justify-center rounded-lg border border-kb-border bg-kb-surface text-sm text-kb-muted">
      Harita yükleniyor…
    </div>
  ),
});

export default function TrackReportPanel({ data }: { data: TrackReportData }) {
  return <TrackReportMap data={data} />;
}
