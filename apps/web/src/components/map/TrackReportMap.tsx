"use client";

import { useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
} from "react-leaflet";
import { divIcon, latLngBounds, type Map as LeafletMap } from "leaflet";
import { format } from "date-fns";
import "leaflet/dist/leaflet.css";
import { BASEMAPS, KARS_CENTER, type Basemap } from "@/components/map/basemaps";
import { btnSecondary } from "@/lib/ui";
import type { TrackReportData } from "@/lib/api/track-dto";

const RENK = {
  planlanan: "#2563eb",
  eksik: "#dc2626",
  iz: "#6b7280",
  sapma: "#f97316",
  duraklamaRotada: "#0d9488",
  duraklamaDisari: "#b91c1c",
  boslugu: "#a855f7",
} as const;

function zamanStr(ms: number): string {
  return format(new Date(ms), "dd.MM HH:mm");
}

function markerIcon(text: string, bg: string) {
  return divIcon({
    className: "",
    html: `<div style="background:${bg};color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:9999px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.4)">${text}</div>`,
    iconAnchor: [14, 10],
  });
}

/** Takip raporu haritası: planlanan rota, iz, sapmalar, duraklamalar, boşluklar */
export default function TrackReportMap({ data }: { data: TrackReportData }) {
  const [basemap, setBasemap] = useState<Basemap>("sokak");
  const mapRef = useRef<LeafletMap | null>(null);

  const izNoktalar = useMemo(
    () => data.iz.map((p) => [p[0], p[1]] as [number, number]),
    [data.iz],
  );

  const bounds = useMemo(() => {
    const noktalar = [...data.planlanan, ...izNoktalar];
    return noktalar.length >= 2 ? latLngBounds(noktalar) : null;
  }, [data.planlanan, izNoktalar]);

  // Rota giriş/çıkış işaretleri: zamana en yakın iz noktası
  const girisNokta = useMemo(() => izZamanNoktasi(data.iz, data.rotaGirisMs), [data]);
  const cikisNokta = useMemo(() => izZamanNoktasi(data.iz, data.rotaCikisMs), [data]);

  // Veri boşlukları: boşluğun iki ucundaki iz noktaları arasına kesikli çizgi
  const boslukCizgileri = useMemo(
    () =>
      data.veriBosluklari
        .map((b) => {
          const bas = izZamanNoktasi(data.iz, b.baslangicMs);
          const bit = izZamanNoktasi(data.iz, b.bitisMs);
          return bas && bit ? { b, hat: [bas, bit] as [number, number][] } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [data],
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(BASEMAPS) as Basemap[]).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBasemap(b)}
            className={
              basemap === b
                ? "inline-flex items-center rounded-md bg-kb-navy px-3 py-1.5 text-sm font-semibold text-white"
                : btnSecondary
            }
          >
            {BASEMAPS[b].label}
          </button>
        ))}
      </div>

      <div className="kb-map relative min-h-[420px] overflow-hidden rounded-xl border border-kb-border shadow-md">
        <MapContainer
          ref={mapRef}
          center={KARS_CENTER}
          zoom={14}
          bounds={bounds ?? undefined}
          className="h-[60vh] min-h-[420px] w-full"
        >
          <TileLayer
            key={basemap}
            attribution={BASEMAPS[basemap].attribution}
            url={BASEMAPS[basemap].url}
          />

          {/* Planlanan rota */}
          {data.planlanan.length >= 2 && (
            <Polyline
              positions={data.planlanan}
              pathOptions={{ color: RENK.planlanan, weight: 6, opacity: 0.7 }}
            >
              <Tooltip sticky>Planlanan rota</Tooltip>
            </Polyline>
          )}

          {/* Eksik (kat edilmeyen) segmentler */}
          {data.eksikSegmentler.map((seg, i) => (
            <Polyline
              key={`eksik-${i}`}
              positions={seg}
              pathOptions={{
                color: RENK.eksik,
                weight: 6,
                opacity: 0.9,
                dashArray: "10 8",
              }}
            >
              <Tooltip sticky>Kat edilmeyen bölüm</Tooltip>
            </Polyline>
          ))}

          {/* GPS izi */}
          {izNoktalar.length >= 2 && (
            <Polyline
              positions={izNoktalar}
              pathOptions={{ color: RENK.iz, weight: 2.5, opacity: 0.8 }}
            >
              <Tooltip sticky>Araç izi ({data.iz.length} ping)</Tooltip>
            </Polyline>
          )}

          {/* Sapma iz parçaları */}
          {data.sapmalar.map((s, i) => (
            <Polyline
              key={`sapma-${i}`}
              positions={s.izler}
              pathOptions={{ color: RENK.sapma, weight: 5, opacity: 0.95 }}
            >
              <Popup>
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">Rota dışı sapma</p>
                  <p className="text-xs">
                    {zamanStr(s.baslangicMs)} → {zamanStr(s.bitisMs)} ({s.sureDk} dk)
                  </p>
                  <p className="text-xs">En büyük sapma: {s.maxMesafeM} m</p>
                </div>
              </Popup>
            </Polyline>
          ))}

          {/* Veri boşlukları */}
          {boslukCizgileri.map(({ b, hat }, i) => (
            <Polyline
              key={`bosluk-${i}`}
              positions={hat}
              pathOptions={{
                color: RENK.boslugu,
                weight: 3,
                opacity: 0.8,
                dashArray: "2 8",
              }}
            >
              <Popup>
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">Veri boşluğu</p>
                  <p className="text-xs">
                    {zamanStr(b.baslangicMs)} → {zamanStr(b.bitisMs)} ({b.sureDk} dk ping yok)
                  </p>
                </div>
              </Popup>
            </Polyline>
          ))}

          {/* Duraklamalar */}
          {data.duraklamalar.map((d, i) => (
            <CircleMarker
              key={`durak-${i}`}
              center={[d.lat, d.lng]}
              radius={8}
              pathOptions={{
                color: d.rotaUzerinde ? RENK.duraklamaRotada : RENK.duraklamaDisari,
                weight: 3,
                fillColor: "#ffffff",
                fillOpacity: 0.9,
              }}
            >
              <Popup>
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">
                    Duraklama {d.rotaUzerinde ? "(rota üzerinde)" : "(rota dışında)"}
                  </p>
                  <p className="text-xs">
                    {zamanStr(d.baslangicMs)} → {zamanStr(d.bitisMs)} ({d.sureDk} dk)
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {/* Rota giriş/çıkış işaretleri */}
          {girisNokta && data.rotaGirisMs != null && (
            <Marker position={girisNokta} icon={markerIcon("Giriş", "#16a34a")}>
              <Popup>Rotaya giriş: {zamanStr(data.rotaGirisMs)}</Popup>
            </Marker>
          )}
          {cikisNokta && data.rotaCikisMs != null && (
            <Marker position={cikisNokta} icon={markerIcon("Çıkış", "#dc2626")}>
              <Popup>Rotadan çıkış: {zamanStr(data.rotaCikisMs)}</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-kb-muted">
        <Lejant renk={RENK.planlanan} etiket="Planlanan rota" />
        <Lejant renk={RENK.eksik} etiket="Kat edilmeyen bölüm" kesikli />
        <Lejant renk={RENK.iz} etiket="Araç izi" />
        <Lejant renk={RENK.sapma} etiket="Rota dışı sapma" />
        <Lejant renk={RENK.duraklamaRotada} etiket="Duraklama (rotada)" nokta />
        <Lejant renk={RENK.duraklamaDisari} etiket="Duraklama (rota dışı)" nokta />
        <Lejant renk={RENK.boslugu} etiket="Veri boşluğu" kesikli />
      </div>
    </div>
  );
}

function Lejant({
  renk,
  etiket,
  kesikli,
  nokta,
}: {
  renk: string;
  etiket: string;
  kesikli?: boolean;
  nokta?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {nokta ? (
        <span
          className="inline-block h-2.5 w-2.5 rounded-full border-2 bg-white"
          style={{ borderColor: renk }}
        />
      ) : (
        <span
          className="inline-block w-5 align-middle"
          style={{ borderTop: `3px ${kesikli ? "dashed" : "solid"} ${renk}` }}
        />
      )}
      {etiket}
    </span>
  );
}

/** Verilen zamana (ms) en yakın iz noktasını döndürür */
function izZamanNoktasi(
  iz: [number, number, number, number | null][],
  ms: number | null,
): [number, number] | null {
  if (ms == null || iz.length === 0) return null;
  let enYakin = iz[0];
  for (const p of iz) {
    if (Math.abs(p[2] - ms) < Math.abs(enYakin[2] - ms)) enYakin = p;
  }
  return [enYakin[0], enYakin[1]];
}
