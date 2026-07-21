"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { formatLength, roadLengthMeters } from "@/components/map/road-map-geo";
import {
  ASFALT_DURUM_LABELS,
  HAZARD_TIP_LABELS,
  type ComplaintPinDto,
  type HazardDto,
  type RoadDto,
} from "@/components/map/road-map-types";

const KARS_CENTER: [number, number] = [43.0975, 40.6013]; // maplibre: [lng, lat]

type Basemap3D = "sokak" | "sade" | "uydu";

const RASTER_TILES: Record<Basemap3D, { tiles: string[]; attribution: string }> = {
  sokak: {
    tiles: ["a", "b", "c", "d"].map(
      (s) => `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png`,
    ),
    attribution: "© OpenStreetMap © CARTO",
  },
  sade: {
    tiles: ["a", "b", "c", "d"].map(
      (s) => `https://${s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png`,
    ),
    attribution: "© OpenStreetMap © CARTO",
  },
  uydu: {
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    ],
    attribution: "© Esri — World Imagery",
  },
};

const DURUM_RENK: Record<RoadDto["durum"], string> = {
  TAMAMLANDI: "#16a34a",
  DEVAM_EDIYOR: "#f59e0b",
  PLANLANDI: "#64748b",
};

function hazardPinHtml(h: HazardDto): string {
  const color =
    h.durum === "GIDERILDI"
      ? "#94a3b8"
      : h.tip === "CUKUR"
        ? "#dc2626"
        : h.tip === "ENGEL"
          ? "#ea580c"
          : "#7c3aed";
  const glyph = h.tip === "CUKUR" ? "!" : h.tip === "ENGEL" ? "▲" : "?";
  const pulse =
    h.durum === "ACIK"
      ? '<span class="kb-pin-pulse" style="top:0;left:0;width:26px;height:26px;"></span>'
      : "";
  return `<div class="kb-hazard-pin" style="position:relative;width:26px;height:26px;">${pulse}<div class="kb-pin-dot" style="background:${color};"><span style="color:#fff;font-weight:800;">${glyph}</span></div></div>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default function RoadMap3D({
  roads,
  hazards,
  complaints,
  basemap,
  showBuildings,
}: {
  roads: RoadDto[];
  hazards: HazardDto[];
  complaints: ComplaintPinDto[];
  basemap: Basemap3D;
  showBuildings: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      center: KARS_CENTER,
      zoom: 13.2,
      pitch: 62,
      bearing: -18,
      maxPitch: 80,
      attributionControl: { compact: true },
      style: {
        version: 8,
        sources: {
          altlik: {
            type: "raster",
            tiles: RASTER_TILES[basemap].tiles,
            tileSize: 256,
            attribution: RASTER_TILES[basemap].attribution,
          },
          dem: {
            type: "raster-dem",
            tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
            encoding: "terrarium",
            tileSize: 256,
            maxzoom: 14,
            attribution: "Terrain: Mapzen/AWS Open Data",
          },
        },
        layers: [
          { id: "altlik", type: "raster", source: "altlik" },
          {
            id: "golgeleme",
            type: "hillshade",
            source: "dem",
            paint: { "hillshade-exaggeration": 0.35 },
          },
        ],
        sky: {
          "sky-color": "#9cc3e8",
          "horizon-color": "#e6eef7",
          "fog-color": "#dfe8f2",
          "sky-horizon-blend": 0.6,
        },
        terrain: { source: "dem", exaggeration: 1.4 },
      },
    });

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "top-right",
    );
    map.addControl(
      new maplibregl.TerrainControl({ source: "dem", exaggeration: 1.4 }),
      "top-right",
    );

    const markers: maplibregl.Marker[] = [];

    map.on("load", () => {
      if (showBuildings) {
        // OpenFreeMap: ücretsiz OpenMapTiles vektör servisi (anahtar gerektirmez)
        map.addSource("binalar", {
          type: "vector",
          url: "https://tiles.openfreemap.org/planet",
        });
        map.addLayer({
          id: "bina-3d",
          type: "fill-extrusion",
          source: "binalar",
          "source-layer": "building",
          minzoom: 13,
          paint: {
            "fill-extrusion-color": [
              "interpolate",
              ["linear"],
              ["coalesce", ["get", "render_height"], 8],
              0,
              "#e3d9cb",
              25,
              "#c9b8a2",
              60,
              "#a8917a",
            ],
            // Yükseklik verisi olmayan binalar için ~2-3 kat varsayımı
            "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
            "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
            "fill-extrusion-opacity": 0.88,
          },
        });
      }

      const roadFeatures = roads
        .filter((r) => r.koordinatlar.length >= 2)
        .map((r) => ({
          type: "Feature" as const,
          properties: {
            ad: r.ad,
            renk: DURUM_RENK[r.durum],
            durum: ASFALT_DURUM_LABELS[r.durum],
            planli: r.durum === "PLANLANDI",
            uzunluk: formatLength(roadLengthMeters(r.koordinatlar)),
          },
          geometry: {
            type: "LineString" as const,
            coordinates: r.koordinatlar.map(([lat, lng]) => [lng, lat]),
          },
        }));

      map.addSource("yollar", {
        type: "geojson",
        data: { type: "FeatureCollection", features: roadFeatures },
      });

      map.addLayer({
        id: "yol-kontur",
        type: "line",
        source: "yollar",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": 0.9 },
      });
      map.addLayer({
        id: "yol-duz",
        type: "line",
        source: "yollar",
        filter: ["!", ["get", "planli"]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "renk"], "line-width": 5 },
      });
      map.addLayer({
        id: "yol-planli",
        type: "line",
        source: "yollar",
        filter: ["get", "planli"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "renk"],
          "line-width": 5,
          "line-dasharray": [2, 2],
        },
      });

      const yolLayers = ["yol-duz", "yol-planli"];

      // Terrain açıkken ince çizgiye tam tıklamak zor — 8px toleranslı sorgu
      map.on("click", (e) => {
        const pad = 8;
        const feats = map.queryRenderedFeatures(
          [
            [e.point.x - pad, e.point.y - pad],
            [e.point.x + pad, e.point.y + pad],
          ],
          { layers: yolLayers },
        );
        const f = feats[0];
        if (!f) return;
        const p = f.properties as Record<string, string>;
        new maplibregl.Popup({ closeButton: false })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-size:13px;line-height:1.45;"><b>${esc(p.ad)}</b><br/>${esc(p.durum)} — ${esc(p.uzunluk)}</div>`,
          )
          .addTo(map);
      });

      map.on("mousemove", (e) => {
        const feats = map.queryRenderedFeatures(e.point, { layers: yolLayers });
        map.getCanvas().style.cursor = feats.length > 0 ? "pointer" : "";
      });
    });

    for (const h of hazards) {
      const el = document.createElement("div");
      el.innerHTML = hazardPinHtml(h);
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([h.lng, h.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 26, closeButton: false }).setHTML(
            `<div style="font-size:13px;line-height:1.45;"><b>${HAZARD_TIP_LABELS[h.tip]}${h.durum === "GIDERILDI" ? " (giderildi)" : ""}</b>${h.aciklama ? `<br/>${esc(h.aciklama)}` : ""}</div>`,
          ),
        )
        .addTo(map);
      markers.push(marker);
    }

    for (const c of complaints) {
      const el = document.createElement("div");
      el.style.cssText =
        "width:14px;height:14px;border-radius:9999px;background:#2563eb;border:2px solid #fff;box-shadow:0 2px 6px rgba(21,42,69,.4);";
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([c.lng, c.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 12, closeButton: false }).setHTML(
            `<div style="font-size:13px;line-height:1.45;"><b>${esc(c.sikayetNo)}</b><br/>${esc(c.durum)}</div>`,
          ),
        )
        .addTo(map);
      markers.push(marker);
    }

    return () => {
      markers.forEach((m) => m.remove());
      map.remove();
    };
  }, [roads, hazards, complaints, basemap, showBuildings]);

  return (
    <div
      ref={containerRef}
      className="h-[calc(100vh-220px)] min-h-[480px] w-full"
    />
  );
}
