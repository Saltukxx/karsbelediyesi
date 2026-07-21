"use client";

import dynamic from "next/dynamic";
import type { ComplaintPinDto, HazardDto, RoadDto } from "@/components/map/road-map-types";

const RoadMap = dynamic(() => import("@/components/map/RoadMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-220px)] min-h-[480px] items-center justify-center rounded-lg border border-kb-border bg-kb-surface text-sm text-kb-muted">
      Harita yükleniyor…
    </div>
  ),
});

export default function RoadMapPanel(props: {
  roads: RoadDto[];
  hazards: HazardDto[];
  complaints: ComplaintPinDto[];
  canEdit: boolean;
}) {
  return <RoadMap {...props} />;
}
