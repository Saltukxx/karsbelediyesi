"use client";

import { MapContainer, TileLayer } from "react-leaflet";
import HeatLayer from "@/components/map/HeatLayer";
import { BASEMAPS, KARS_CENTER } from "@/components/map/basemaps";
import "leaflet/dist/leaflet.css";

/**
 * Şikayet yoğunluk haritası — leaflet.heat katmanıyla, sade altlık üzerinde.
 * Konum varsa görünüm noktaları kapsayacak şekilde açılır; yoksa Kars merkezi.
 */
export default function ComplaintHeatMap({
  points,
}: {
  points: Array<[number, number]>;
}) {
  const konumVar = points.length > 0;

  return (
    <MapContainer
      {...(konumVar
        ? { bounds: points, boundsOptions: { padding: [48, 48], maxZoom: 15 } }
        : { center: KARS_CENTER, zoom: 13 })}
      scrollWheelZoom={false}
      className="z-0 h-[380px] w-full rounded-md border border-kb-border"
    >
      <TileLayer
        url={BASEMAPS.sade.url}
        attribution={BASEMAPS.sade.attribution}
      />
      <HeatLayer points={points} />
    </MapContainer>
  );
}
