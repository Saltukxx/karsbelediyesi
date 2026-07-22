"use client";

import dynamic from "next/dynamic";
import type { ParcelDto } from "@/components/map/parcel-api";

const ParcelMap = dynamic(() => import("@/components/map/ParcelMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-220px)] min-h-[480px] items-center justify-center rounded-lg border border-kb-border bg-kb-surface text-sm text-kb-muted">
      Harita yükleniyor…
    </div>
  ),
});

export default function ParcelMapPanel(props: { initialParcels: ParcelDto[] }) {
  return <ParcelMap {...props} />;
}
