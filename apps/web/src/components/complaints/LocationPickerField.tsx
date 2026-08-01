"use client";

import dynamic from "next/dynamic";

const LocationPicker = dynamic(
  () =>
    import("@/components/complaints/LocationPicker").then((m) => m.LocationPicker),
  {
    ssr: false,
    loading: () => (
      <div className="h-[260px] w-full animate-pulse rounded-md border border-kb-border bg-kb-border/30" />
    ),
  },
);

type Mahalle = { id: string; name: string };

/** Sunucu bileşenlerinden güvenle kullanılacak Leaflet konum seçici. */
export function LocationPickerField(props: {
  initialLat?: number | null;
  initialLng?: number | null;
  mahalleler?: Mahalle[];
  height?: number;
}) {
  return <LocationPicker {...props} />;
}
