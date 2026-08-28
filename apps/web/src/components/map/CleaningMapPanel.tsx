"use client";

import dynamic from "next/dynamic";
import type { CleaningRouteDto } from "@/components/map/cleaning-types";
import type { WinterDriverDto, WinterVehicleDto } from "@/components/map/winter-types";

const CleaningMap = dynamic(() => import("@/components/map/CleaningMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[var(--kb-map-height)] min-h-[480px] items-center justify-center rounded-lg border border-kb-border bg-kb-surface text-sm text-kb-muted">
      Harita yükleniyor…
    </div>
  ),
});

export default function CleaningMapPanel(props: {
  routes: CleaningRouteDto[];
  vehicles: WinterVehicleDto[];
  drivers: WinterDriverDto[];
  canEdit: boolean;
}) {
  return <CleaningMap {...props} />;
}
