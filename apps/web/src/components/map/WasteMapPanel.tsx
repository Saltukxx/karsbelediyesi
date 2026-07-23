"use client";

import dynamic from "next/dynamic";
import type { WasteRouteDto } from "@/components/map/waste-types";
import type { WinterDriverDto, WinterVehicleDto } from "@/components/map/winter-types";

const WasteMap = dynamic(() => import("@/components/map/WasteMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-220px)] min-h-[480px] items-center justify-center rounded-lg border border-kb-border bg-kb-surface text-sm text-kb-muted">
      Harita yükleniyor…
    </div>
  ),
});

export default function WasteMapPanel(props: {
  routes: WasteRouteDto[];
  vehicles: WinterVehicleDto[];
  drivers: WinterDriverDto[];
  canEdit: boolean;
}) {
  return <WasteMap {...props} />;
}
