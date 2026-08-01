"use client";

import dynamic from "next/dynamic";
import type {
  ComplaintPinDto,
  DepartmentOptionDto,
  HazardDto,
  LiveVehicleDto,
  PersonnelOptionDto,
  RoadDto,
} from "@/components/map/road-map-types";

const RoadMap = dynamic(() => import("@/components/map/RoadMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[var(--kb-map-height)] min-h-[480px] items-center justify-center rounded-lg border border-kb-border bg-kb-surface text-sm text-kb-muted">
      Harita yükleniyor…
    </div>
  ),
});

export default function RoadMapPanel(props: {
  roads: RoadDto[];
  hazards: HazardDto[];
  complaints: ComplaintPinDto[];
  liveVehicles: LiveVehicleDto[];
  canEdit: boolean;
  mudurlukler: DepartmentOptionDto[];
  atanabilirPersonel: PersonnelOptionDto[];
  personelAtayabilir: boolean;
}) {
  return <RoadMap {...props} />;
}
