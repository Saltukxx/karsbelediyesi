"use client";

import { useRef, useState } from "react";
import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import {
  latLngBounds,
  type LeafletMouseEvent,
  type Map as LeafletMap,
} from "leaflet";
import "leaflet/dist/leaflet.css";
import { btnSecondary } from "@/lib/ui";
import { BASEMAPS, KARS_CENTER, type Basemap } from "@/components/map/basemaps";
import ParcelLayer from "@/components/map/ParcelLayer";
import ParcelSearchPanel from "@/components/map/ParcelSearchPanel";
import {
  geometriToLeafletPositions,
  parselByAdaParsel,
  parselByKoordinat,
  type ParcelDto,
} from "@/components/map/parcel-api";

function MapClickHandler({ onClick }: { onClick: (e: LeafletMouseEvent) => void }) {
  useMapEvents({ click: onClick });
  return null;
}

export default function ParcelMap({
  initialParcels,
}: {
  initialParcels: ParcelDto[];
}) {
  const [basemap, setBasemap] = useState<Basemap>("sokak");
  const [clickActive, setClickActive] = useState(true);
  const [parcels, setParcels] = useState<ParcelDto[]>(initialParcels);
  const [clickLoading, setClickLoading] = useState(false);
  const [clickError, setClickError] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  function focusParcel(p: ParcelDto) {
    // Polygon/MultiPolygon farkını düzleştirip tüm [lat,lng] noktalarını topla
    const points: [number, number][] = [];
    const collect = (arr: unknown): void => {
      if (
        Array.isArray(arr) &&
        arr.length === 2 &&
        typeof arr[0] === "number" &&
        typeof arr[1] === "number"
      ) {
        points.push(arr as [number, number]);
        return;
      }
      if (Array.isArray(arr)) arr.forEach(collect);
    };
    collect(geometriToLeafletPositions(p.geometri));
    if (points.length > 0) {
      mapRef.current?.fitBounds(latLngBounds(points), { padding: [60, 60] });
    } else {
      mapRef.current?.flyTo([p.lat, p.lng], 17, { duration: 0.8 });
    }
  }

  function upsertParcelInState(p: ParcelDto) {
    setParcels((prev) => [p, ...prev.filter((x) => x.id !== p.id)]);
  }

  async function queryParcelAtPoint(lat: number, lng: number) {
    // Önceki istek dönmeden yeni tıklama → eskisini iptal et
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setClickLoading(true);
    setClickError(null);
    try {
      const result = await parselByKoordinat(lat, lng, controller.signal);
      upsertParcelInState(result);
      focusParcel(result);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setClickError(
        err instanceof Error ? err.message : "Parsel sorgusu başarısız oldu",
      );
    } finally {
      if (abortRef.current === controller) {
        setClickLoading(false);
      }
    }
  }

  function handleMapClick(e: LeafletMouseEvent) {
    if (!clickActive) return;
    void queryParcelAtPoint(e.latlng.lat, e.latlng.lng);
  }

  function handleResult(p: ParcelDto) {
    setClickError(null);
    upsertParcelInState(p);
    focusParcel(p);
  }

  async function refreshParcel(p: ParcelDto) {
    setRefreshingId(p.id);
    try {
      const result = await parselByAdaParsel(
        p.mahalleId,
        p.adaNo,
        p.parselNo,
        true,
      );
      upsertParcelInState(result);
    } catch (err) {
      setClickError(
        err instanceof Error ? err.message : "Yenileme başarısız oldu",
      );
    } finally {
      setRefreshingId(null);
    }
  }

  function removeParcel(p: ParcelDto) {
    mapRef.current?.closePopup();
    setParcels((prev) => prev.filter((x) => x.id !== p.id));
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="kb-map relative min-h-[480px] flex-1 overflow-hidden rounded-xl border border-kb-border shadow-md">
        <MapContainer
          ref={mapRef}
          center={KARS_CENTER}
          zoom={14}
          className="h-[calc(100vh-220px)] min-h-[480px] w-full"
          style={clickActive ? { cursor: "crosshair" } : undefined}
        >
          <TileLayer
            key={basemap}
            attribution={BASEMAPS[basemap].attribution}
            url={BASEMAPS[basemap].url}
          />
          <MapClickHandler onClick={handleMapClick} />
          <ParcelLayer
            parcels={parcels}
            onRefresh={(p) => void refreshParcel(p)}
            onRemove={removeParcel}
            refreshingId={refreshingId}
          />
        </MapContainer>
      </div>

      <aside className="w-full shrink-0 space-y-4 lg:w-80">
        <ParcelSearchPanel
          active={clickActive}
          is3D={false}
          onToggleActive={() => {
            setClickError(null);
            setClickActive((v) => !v);
          }}
          clickLoading={clickLoading}
          clickError={clickError}
          parcels={parcels}
          onResult={handleResult}
          onFocus={focusParcel}
          onRemove={removeParcel}
          onClearAll={() => {
            mapRef.current?.closePopup();
            setParcels([]);
          }}
        />

        <div className="rounded-lg border border-kb-border bg-kb-surface-raised p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-kb-muted">
            Altlık harita
          </p>
          <div className="flex gap-2">
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
        </div>

        <div className="space-y-1.5 rounded-lg border border-kb-border bg-kb-surface-raised p-4 text-xs text-kb-muted shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-kb-muted">
            Bilgi
          </p>
          <p>
            <span
              className="mr-1 inline-block h-2 w-4 rounded-sm border align-middle"
              style={{ borderColor: "#0284c7", background: "rgba(56,189,248,0.25)" }}
            />
            Kadastro parseli (TKGM)
          </p>
          <p>
            Veriler TKGM MEGSİS servisinden alınır; sorgulanan parseller
            önbelleğe kaydedilir ve sonraki açılışlarda haritada hazır gelir.
          </p>
          <p>
            TKGM servisi zaman zaman yavaş yanıt verebilir — sorgular birkaç
            saniye sürebilir.
          </p>
        </div>
      </aside>
    </div>
  );
}
