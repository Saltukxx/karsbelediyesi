"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import type * as L from "leaflet";
// Sıra önemli: önce global L kurulumu, sonra plugin (plugin global L'e yazar)
import { heatLayerFactory } from "@/components/map/leaflet-heat-setup";
import "leaflet.heat";

/** leaflet.heat tabanlı yoğunluk katmanı — react-leaflet haritasına useMap ile bağlanır */
export default function HeatLayer({
  points,
}: {
  points: Array<[number, number]>;
}) {
  const map = useMap();
  const layerRef = useRef<L.HeatLayer | null>(null);

  useEffect(() => {
    const layer = heatLayerFactory()([], {
      radius: 28,
      blur: 20,
      maxZoom: 17,
      minOpacity: 0.35,
    });
    layer.addTo(map);
    layerRef.current = layer;
    return () => {
      layer.remove();
      layerRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    layerRef.current?.setLatLngs(points);
  }, [points]);

  return null;
}
