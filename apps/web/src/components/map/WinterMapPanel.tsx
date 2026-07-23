"use client";

import dynamic from "next/dynamic";
import type {
  WinterDriverDto,
  WinterMaterialDto,
  WinterRouteDto,
  WinterVehicleDto,
} from "@/components/map/winter-types";

const WinterMap = dynamic(() => import("@/components/map/WinterMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-220px)] min-h-[480px] items-center justify-center rounded-lg border border-kb-border bg-kb-surface text-sm text-kb-muted">
      Harita yükleniyor…
    </div>
  ),
});

export default function WinterMapPanel(props: {
  routes: WinterRouteDto[];
  vehicles: WinterVehicleDto[];
  drivers: WinterDriverDto[];
  materials: WinterMaterialDto[];
  canEdit: boolean;
}) {
  return <WinterMap {...props} />;
}
