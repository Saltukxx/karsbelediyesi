"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMapEvents,
} from "react-leaflet";
import {
  divIcon,
  latLngBounds,
  type LeafletMouseEvent,
  type Map as LeafletMap,
} from "leaflet";
import Link from "next/link";
import { format } from "date-fns";
import "leaflet/dist/leaflet.css";
import {
  asfaltYolGuncelle,
  asfaltYolKaydet,
  asfaltYolSil,
  engelDurumGuncelle,
  engelKaydet,
  engelSil,
} from "@/lib/actions/harita";
import { btnPrimary, btnSecondary, inputCls, labelCls } from "@/lib/ui";
import { formatLength, roadLengthMeters } from "@/components/map/road-map-geo";
import RoadMapTables from "@/components/map/RoadMapTables";
import RoadMap3D from "@/components/map/RoadMap3D";
import HeatLayer from "@/components/map/HeatLayer";
import { BASEMAPS, KARS_CENTER, type Basemap } from "@/components/map/basemaps";
import {
  ASFALT_DURUM_LABELS,
  HAZARD_TIP_LABELS,
  type AsfaltDurumDto,
  type ComplaintPinDto,
  type HazardDto,
  type HazardTipDto,
  type LiveVehicleDto,
  type RoadDto,
} from "@/components/map/road-map-types";

/** Nominatim aramasını Kars çevresine öncelikleyen kutu (lon1,lat1,lon2,lat2) */
const KARS_VIEWBOX = "42.9,40.65,43.3,40.55";

type Mode = "gezinme" | "yolCiz" | "engelEkle";
type RoadFilter = "ALL" | AsfaltDurumDto;
type HazardFilter = "ALL" | "ACIK" | "GIDERILDI";
type ComplaintFilter = "ALL" | "ACIK";

interface GeocodeResult {
  displayName: string;
  lat: number;
  lng: number;
}

function roadColor(durum: AsfaltDurumDto): string {
  switch (durum) {
    case "TAMAMLANDI":
      return "#16a34a";
    case "DEVAM_EDIYOR":
      return "#f59e0b";
    case "PLANLANDI":
      return "#64748b";
    default: {
      const _exhaustive: never = durum;
      return _exhaustive;
    }
  }
}

function hazardColor(tip: HazardTipDto, durum: HazardDto["durum"]): string {
  if (durum === "GIDERILDI") return "#94a3b8";
  switch (tip) {
    case "CUKUR":
      return "#dc2626";
    case "ENGEL":
      return "#ea580c";
    case "DIGER":
      return "#7c3aed";
    default: {
      const _exhaustive: never = tip;
      return _exhaustive;
    }
  }
}

function hazardGlyph(tip: HazardTipDto): string {
  switch (tip) {
    case "CUKUR":
      return "!";
    case "ENGEL":
      return "▲";
    case "DIGER":
      return "?";
    default: {
      const _exhaustive: never = tip;
      return _exhaustive;
    }
  }
}

function hazardIcon(h: HazardDto) {
  const color = hazardColor(h.tip, h.durum);
  const pulse =
    h.durum === "ACIK"
      ? '<span class="kb-pin-pulse" style="top:0;left:0;width:26px;height:26px;"></span>'
      : "";
  return divIcon({
    className: "kb-hazard-pin",
    html: `<div style="position:relative;width:26px;height:26px;">${pulse}<div class="kb-pin-dot" style="background:${color};"><span style="color:#fff;font-weight:800;">${hazardGlyph(h.tip)}</span></div></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
  });
}

function vehicleIcon(plaka: string) {
  return divIcon({
    className: "kb-vehicle-pin",
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;"><div style="width:14px;height:14px;border-radius:9999px;background:#0d9488;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);"></div><span style="background:#0f172a;color:#fff;font-size:10px;font-weight:700;padding:1px 5px;border-radius:4px;white-space:nowrap;">${plaka}</span></div>`,
    iconSize: [60, 32],
    iconAnchor: [30, 8],
    popupAnchor: [0, -8],
  });
}

function MapClickHandler({ onClick }: { onClick: (e: LeafletMouseEvent) => void }) {
  useMapEvents({ click: onClick });
  return null;
}

export default function RoadMap({
  roads,
  hazards,
  complaints,
  liveVehicles,
  canEdit,
}: {
  roads: RoadDto[];
  hazards: HazardDto[];
  complaints: ComplaintPinDto[];
  liveVehicles: LiveVehicleDto[];
  canEdit: boolean;
}) {
  const [mode, setMode] = useState<Mode>("gezinme");
  const [is3D, setIs3D] = useState(false);
  const [showBuildings, setShowBuildings] = useState(true);
  const [basemap, setBasemap] = useState<Basemap>("sokak");
  const [hoverRoadId, setHoverRoadId] = useState<string | null>(null);
  const [showRoads, setShowRoads] = useState(true);
  const [showHazards, setShowHazards] = useState(true);
  const [showComplaints, setShowComplaints] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showVehicles, setShowVehicles] = useState(true);
  const [roadFilter, setRoadFilter] = useState<RoadFilter>("ALL");
  const [hazardFilter, setHazardFilter] = useState<HazardFilter>("ALL");
  const [complaintFilter, setComplaintFilter] = useState<ComplaintFilter>("ALL");
  const [draftPoints, setDraftPoints] = useState<[number, number][]>([]);
  const [draftHazard, setDraftHazard] = useState<[number, number] | null>(null);
  const [editRoadId, setEditRoadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const mapRef = useRef<LeafletMap | null>(null);
  const roadFormRef = useRef<HTMLFormElement>(null);
  const hazardFormRef = useRef<HTMLFormElement>(null);

  const editingRoad = editRoadId ? roads.find((r) => r.id === editRoadId) ?? null : null;

  const visibleRoads = useMemo(
    () => roads.filter((r) => roadFilter === "ALL" || r.durum === roadFilter),
    [roads, roadFilter],
  );
  const visibleHazards = useMemo(
    () => hazards.filter((h) => hazardFilter === "ALL" || h.durum === hazardFilter),
    [hazards, hazardFilter],
  );
  const visibleComplaints = useMemo(
    () =>
      complaints.filter(
        (c) =>
          complaintFilter === "ALL" ||
          c.durumKodu === "ACIK" ||
          c.durumKodu === "DEVAM_EDIYOR",
      ),
    [complaints, complaintFilter],
  );

  const heatPoints = useMemo<Array<[number, number]>>(
    () => visibleComplaints.map((c) => [c.lat, c.lng]),
    [visibleComplaints],
  );

  const draftLength = roadLengthMeters(draftPoints);

  function handleMapClick(e: LeafletMouseEvent) {
    if (!canEdit) return;
    if (mode === "yolCiz") {
      setDraftPoints((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
    } else if (mode === "engelEkle") {
      setDraftHazard([e.latlng.lat, e.latlng.lng]);
    }
  }

  function resetDrafts() {
    setDraftPoints([]);
    setDraftHazard(null);
    setEditRoadId(null);
    setMode("gezinme");
  }

  function startEditRoad(road: RoadDto) {
    mapRef.current?.closePopup();
    setDraftHazard(null);
    setDraftPoints(road.koordinatlar);
    setEditRoadId(road.id);
    setMode("yolCiz");
  }

  async function submitRoad(formData: FormData) {
    formData.set("koordinatlar", JSON.stringify(draftPoints));
    if (editRoadId) {
      formData.set("id", editRoadId);
      await asfaltYolGuncelle(formData);
    } else {
      await asfaltYolKaydet(formData);
    }
    roadFormRef.current?.reset();
    resetDrafts();
  }

  async function submitHazard(formData: FormData) {
    if (!draftHazard) return;
    formData.set("lat", String(draftHazard[0]));
    formData.set("lng", String(draftHazard[1]));
    await engelKaydet(formData);
    hazardFormRef.current?.reset();
    resetDrafts();
  }

  function deleteRoad(id: string) {
    if (!window.confirm("Bu yol kaydı silinsin mi?")) return;
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => asfaltYolSil(fd));
  }

  function deleteHazard(id: string) {
    if (!window.confirm("Bu nokta silinsin mi?")) return;
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => engelSil(fd));
  }

  function toggleHazardDurum(h: HazardDto) {
    const fd = new FormData();
    fd.set("id", h.id);
    fd.set("durum", h.durum === "ACIK" ? "GIDERILDI" : "ACIK");
    startTransition(() => engelDurumGuncelle(fd));
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const params = new URLSearchParams({
        format: "jsonv2",
        q: `${q}, Kars`,
        countrycodes: "tr",
        viewbox: KARS_VIEWBOX,
        limit: "5",
      });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error("Arama servisi yanıt vermedi");
      const data = (await res.json()) as Array<{
        display_name: string;
        lat: string;
        lon: string;
      }>;
      const results = data.map((d) => ({
        displayName: d.display_name,
        lat: Number(d.lat),
        lng: Number(d.lon),
      }));
      setSearchResults(results);
      if (results.length === 0) setSearchError("Sonuç bulunamadı");
      if (results.length === 1) goToResult(results[0]);
    } catch {
      setSearchError("Arama başarısız oldu, tekrar deneyin");
    } finally {
      setSearching(false);
    }
  }

  function goToResult(r: GeocodeResult) {
    mapRef.current?.flyTo([r.lat, r.lng], 16, { duration: 0.8 });
  }

  function scrollToMap() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function focusRoad(r: RoadDto) {
    if (r.koordinatlar.length > 0) {
      mapRef.current?.fitBounds(latLngBounds(r.koordinatlar), { padding: [40, 40] });
    }
    scrollToMap();
  }

  function focusPoint(lat: number, lng: number) {
    mapRef.current?.flyTo([lat, lng], 17, { duration: 0.8 });
    scrollToMap();
  }

  const modeBtn = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => {
        setDraftPoints([]);
        setDraftHazard(null);
        setEditRoadId(null);
        setMode(mode === m ? "gezinme" : m);
      }}
      className={
        mode === m
          ? "inline-flex items-center justify-center gap-2 rounded-md bg-kb-navy text-white px-3 py-1.5 text-sm font-semibold"
          : btnSecondary
      }
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row">
      <div className="kb-map relative min-h-[480px] flex-1 overflow-hidden rounded-xl border border-kb-border shadow-md">
        {is3D ? (
          <RoadMap3D
            roads={visibleRoads}
            hazards={visibleHazards}
            complaints={visibleComplaints}
            basemap={basemap}
            showBuildings={showBuildings}
          />
        ) : (
        <MapContainer
          ref={mapRef}
          center={KARS_CENTER}
          zoom={14}
          className="h-[calc(100vh-220px)] min-h-[480px] w-full"
          style={mode === "gezinme" ? undefined : { cursor: "crosshair" }}
        >
          <TileLayer
            key={basemap}
            attribution={BASEMAPS[basemap].attribution}
            url={BASEMAPS[basemap].url}
          />
          <MapClickHandler onClick={handleMapClick} />

          {showRoads &&
            visibleRoads
              .filter((r) => r.id !== editRoadId)
              .map((r) => (
                <Polyline
                  key={`casing-${r.id}`}
                  positions={r.koordinatlar}
                  pathOptions={{
                    color: "#ffffff",
                    weight: hoverRoadId === r.id ? 11 : 9,
                    opacity: 0.9,
                    lineCap: "round",
                    lineJoin: "round",
                  }}
                  interactive={false}
                />
              ))}
          {showRoads &&
            visibleRoads
              .filter((r) => r.id !== editRoadId)
              .map((r) => (
                <Polyline
                  key={r.id}
                  positions={r.koordinatlar}
                  pathOptions={{
                    color: roadColor(r.durum),
                    weight: hoverRoadId === r.id ? 7 : 5,
                    opacity: hoverRoadId === r.id ? 1 : 0.9,
                    lineCap: "round",
                    lineJoin: "round",
                    dashArray: r.durum === "PLANLANDI" ? "10 10" : undefined,
                  }}
                  eventHandlers={{
                    mouseover: () => setHoverRoadId(r.id),
                    mouseout: () => setHoverRoadId(null),
                  }}
                >
                  <Tooltip sticky>
                    {r.ad} — {formatLength(roadLengthMeters(r.koordinatlar))}
                  </Tooltip>
                  <Popup>
                    <div className="space-y-1 text-sm">
                      <p className="font-semibold">{r.ad}</p>
                      <p>Durum: {ASFALT_DURUM_LABELS[r.durum]}</p>
                      <p>Uzunluk: {formatLength(roadLengthMeters(r.koordinatlar))}</p>
                      {r.dokumTarihi && (
                        <p>Döküm: {format(new Date(r.dokumTarihi), "dd.MM.yyyy")}</p>
                      )}
                      {r.notlar && <p>{r.notlar}</p>}
                      <p className="text-xs text-gray-500">Ekleyen: {r.olusturan}</p>
                      {canEdit && (
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => startEditRoad(r)}
                            disabled={pending}
                            className="text-xs font-semibold text-kb-navy hover:underline"
                          >
                            Düzenle
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRoad(r.id)}
                            disabled={pending}
                            className="text-xs font-semibold text-red-600 hover:underline"
                          >
                            Sil
                          </button>
                        </div>
                      )}
                    </div>
                  </Popup>
                </Polyline>
              ))}

          {showHazards &&
            visibleHazards.map((h) => (
              <Marker key={h.id} position={[h.lat, h.lng]} icon={hazardIcon(h)}>
                <Tooltip direction="top" offset={[0, -24]}>
                  {HAZARD_TIP_LABELS[h.tip]}
                  {h.durum === "GIDERILDI" ? " (giderildi)" : ""}
                </Tooltip>
                <Popup>
                  <div className="max-w-56 space-y-1 text-sm">
                    <p className="font-semibold">
                      {HAZARD_TIP_LABELS[h.tip]}
                      {h.durum === "GIDERILDI" && " (giderildi)"}
                    </p>
                    {h.aciklama && <p>{h.aciklama}</p>}
                    {h.photoIds.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {h.photoIds.map((pid) => (
                          <a
                            key={pid}
                            href={`/api/ops/hazard-photo/${pid}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/ops/hazard-photo/${pid}`}
                              alt="Fotoğraf"
                              className="h-16 w-16 rounded object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-500">
                      {h.olusturan} — {format(new Date(h.tarih), "dd.MM.yyyy HH:mm")}
                    </p>
                    {canEdit && (
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => toggleHazardDurum(h)}
                          disabled={pending}
                          className="text-xs font-semibold text-kb-navy hover:underline"
                        >
                          {h.durum === "ACIK" ? "Giderildi işaretle" : "Tekrar aç"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteHazard(h.id)}
                          disabled={pending}
                          className="text-xs font-semibold text-red-600 hover:underline"
                        >
                          Sil
                        </button>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

          {showComplaints && showHeatmap && <HeatLayer points={heatPoints} />}

          {showComplaints &&
            !showHeatmap &&
            visibleComplaints.map((c) => (
              <CircleMarker
                key={c.id}
                center={[c.lat, c.lng]}
                radius={7}
                pathOptions={{
                  color: "#ffffff",
                  weight: 2,
                  fillColor: "#2563eb",
                  fillOpacity: 0.9,
                }}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  {c.sikayetNo}
                </Tooltip>
                <Popup>
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold">{c.sikayetNo}</p>
                    <p>Durum: {c.durum}</p>
                    {c.aciklama && <p className="max-w-56">{c.aciklama}</p>}
                    <Link
                      href={`/sikayetler/${c.id}`}
                      className="text-xs font-semibold text-kb-navy hover:underline"
                    >
                      Şikayet detayı →
                    </Link>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

          {showVehicles &&
            liveVehicles.map((v) => (
              <Marker key={`veh-${v.id}`} position={[v.lat, v.lng]} icon={vehicleIcon(v.plaka)}>
                <Popup>
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold">{v.plaka}</p>
                    {v.tip && <p>{v.tip}</p>}
                    <p className="text-xs text-gray-500">
                      Son konum: {format(new Date(v.zaman), "dd.MM.yyyy HH:mm")}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}

          {draftPoints.length > 0 && (
            <Polyline
              positions={draftPoints}
              pathOptions={{
                color: "#0ea5e9",
                weight: 4,
                dashArray: "8 6",
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          )}
          {draftPoints.map((p, i) => (
            <CircleMarker
              key={`draft-${i}`}
              center={p}
              radius={5}
              pathOptions={{
                color: "#0ea5e9",
                weight: 2,
                fillColor: "#ffffff",
                fillOpacity: 1,
              }}
            />
          ))}
          {draftHazard && (
            <CircleMarker
              center={draftHazard}
              radius={9}
              pathOptions={{
                color: "#0ea5e9",
                weight: 2,
                fillColor: "#0ea5e9",
                fillOpacity: 0.6,
              }}
            />
          )}
        </MapContainer>
        )}
      </div>

      <aside className="w-full shrink-0 space-y-4 lg:w-80">
        <div className="rounded-lg border border-kb-border bg-kb-surface-raised p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-kb-muted">
            Konum ara
          </p>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cadde, mahalle, yer adı…"
              className={inputCls}
            />
            <button type="submit" disabled={searching} className={btnSecondary}>
              {searching ? "…" : "Ara"}
            </button>
          </form>
          {searchError && <p className="mt-2 text-xs text-red-600">{searchError}</p>}
          {searchResults.length > 0 && (
            <ul className="mt-2 space-y-1">
              {searchResults.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => goToResult(r)}
                    className="w-full truncate rounded px-2 py-1 text-left text-xs text-kb-ink hover:bg-kb-surface"
                    title={r.displayName}
                  >
                    {r.displayName}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-kb-border bg-kb-surface-raised p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-kb-muted">
            Görünüm
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIs3D(false)}
              className={
                !is3D
                  ? "inline-flex items-center rounded-md bg-kb-navy px-3 py-1.5 text-sm font-semibold text-white"
                  : btnSecondary
              }
            >
              2B
            </button>
            <button
              type="button"
              onClick={() => {
                resetDrafts();
                setIs3D(true);
              }}
              className={
                is3D
                  ? "inline-flex items-center rounded-md bg-kb-navy px-3 py-1.5 text-sm font-semibold text-white"
                  : btnSecondary
              }
            >
              3B (arazi)
            </button>
          </div>
          {is3D && (
            <>
              <label className="mt-3 flex items-center gap-2 text-sm text-kb-ink">
                <input
                  type="checkbox"
                  checked={showBuildings}
                  onChange={(e) => setShowBuildings(e.target.checked)}
                />
                3B binalar
              </label>
              <p className="mt-2 text-xs text-kb-muted">
                Sağ tık / iki parmakla sürükleyerek eğim ve yön değiştirilir. İşaretleme
                2B görünümde yapılır.
              </p>
            </>
          )}
        </div>

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

        <div className="rounded-lg border border-kb-border bg-kb-surface-raised p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-kb-muted">
            Katmanlar
          </p>
          <div className="space-y-2.5 text-sm text-kb-ink">
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showRoads}
                  onChange={(e) => setShowRoads(e.target.checked)}
                />
                Asfalt yollar ({visibleRoads.length})
              </label>
              {showRoads && (
                <select
                  value={roadFilter}
                  onChange={(e) => setRoadFilter(e.target.value as RoadFilter)}
                  className={`${inputCls} mt-1 py-1 text-xs`}
                >
                  <option value="ALL">Tüm durumlar</option>
                  <option value="TAMAMLANDI">Tamamlandı</option>
                  <option value="DEVAM_EDIYOR">Devam Ediyor</option>
                  <option value="PLANLANDI">Planlandı</option>
                </select>
              )}
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showHazards}
                  onChange={(e) => setShowHazards(e.target.checked)}
                />
                Çukur / engeller ({visibleHazards.length})
              </label>
              {showHazards && (
                <select
                  value={hazardFilter}
                  onChange={(e) => setHazardFilter(e.target.value as HazardFilter)}
                  className={`${inputCls} mt-1 py-1 text-xs`}
                >
                  <option value="ALL">Tümü</option>
                  <option value="ACIK">Sadece açık</option>
                  <option value="GIDERILDI">Sadece giderilmiş</option>
                </select>
              )}
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showComplaints}
                  onChange={(e) => setShowComplaints(e.target.checked)}
                />
                Şikayetler ({visibleComplaints.length})
              </label>
              {showComplaints && (
                <>
                  <select
                    value={complaintFilter}
                    onChange={(e) => setComplaintFilter(e.target.value as ComplaintFilter)}
                    className={`${inputCls} mt-1 py-1 text-xs`}
                  >
                    <option value="ALL">Tümü</option>
                    <option value="ACIK">Sadece açık / devam eden</option>
                  </select>
                  <label className="mt-1.5 flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={showHeatmap}
                      onChange={(e) => setShowHeatmap(e.target.checked)}
                    />
                    Isı haritası (yoğunluk)
                  </label>
                </>
              )}
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showVehicles}
                  onChange={(e) => setShowVehicles(e.target.checked)}
                />
                Araçlar (canlı) ({liveVehicles.length})
              </label>
              <p className="mt-0.5 text-xs text-kb-muted">Son 15 dk içinde konum bildirenler</p>
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="rounded-lg border border-kb-border bg-kb-surface-raised p-4 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-kb-muted">
              İşaretleme
            </p>
            {is3D ? (
              <p className="text-xs text-kb-muted">
                İşaretleme yapmak için 2B görünüme geçin.
              </p>
            ) : (
            <div className="flex flex-wrap gap-2">
              {modeBtn("yolCiz", "Yol çiz")}
              {modeBtn("engelEkle", "Çukur / engel ekle")}
            </div>
            )}

            {mode === "yolCiz" && (
              <form
                key={editRoadId ?? "yeni"}
                ref={roadFormRef}
                action={submitRoad}
                className="mt-4 space-y-3"
              >
                {editingRoad && (
                  <p className="rounded bg-kb-surface px-2 py-1 text-xs font-semibold text-kb-navy">
                    &quot;{editingRoad.ad}&quot; düzenleniyor
                  </p>
                )}
                <p className="text-xs text-kb-muted">
                  Haritaya tıklayarak güzergaha nokta ekleyin — {draftPoints.length} nokta
                  {draftPoints.length >= 2 && `, ${formatLength(draftLength)}`}.
                </p>
                <div className="flex flex-wrap gap-2">
                  {draftPoints.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDraftPoints((p) => p.slice(0, -1))}
                      className={btnSecondary}
                    >
                      Son noktayı geri al
                    </button>
                  )}
                  {editingRoad && draftPoints.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDraftPoints([])}
                      className={btnSecondary}
                    >
                      Güzergahı temizle
                    </button>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Yol adı *</label>
                  <input
                    name="ad"
                    required
                    defaultValue={editingRoad?.ad}
                    className={inputCls}
                    placeholder="Örn. Cumhuriyet Cad. 2. etap"
                  />
                </div>
                <div>
                  <label className={labelCls}>Durum</label>
                  <select
                    name="durum"
                    defaultValue={editingRoad?.durum ?? "TAMAMLANDI"}
                    className={inputCls}
                  >
                    <option value="TAMAMLANDI">Tamamlandı</option>
                    <option value="DEVAM_EDIYOR">Devam Ediyor</option>
                    <option value="PLANLANDI">Planlandı</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Döküm tarihi</label>
                  <input
                    type="date"
                    name="dokumTarihi"
                    defaultValue={
                      editingRoad?.dokumTarihi
                        ? editingRoad.dokumTarihi.slice(0, 10)
                        : undefined
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Notlar</label>
                  <textarea
                    name="notlar"
                    rows={2}
                    defaultValue={editingRoad?.notlar ?? undefined}
                    className={inputCls}
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={draftPoints.length < 2} className={btnPrimary}>
                    {editingRoad ? "Güncelle" : "Kaydet"}
                  </button>
                  <button type="button" onClick={resetDrafts} className={btnSecondary}>
                    Vazgeç
                  </button>
                </div>
              </form>
            )}

            {mode === "engelEkle" && (
              <form ref={hazardFormRef} action={submitHazard} className="mt-4 space-y-3">
                <p className="text-xs text-kb-muted">
                  {draftHazard
                    ? `Konum seçildi: ${draftHazard[0].toFixed(5)}, ${draftHazard[1].toFixed(5)}`
                    : "Haritaya tıklayarak konum seçin."}
                </p>
                <div>
                  <label className={labelCls}>Tip</label>
                  <select name="tip" defaultValue="CUKUR" className={inputCls}>
                    <option value="CUKUR">Çukur</option>
                    <option value="ENGEL">Engel</option>
                    <option value="DIGER">Diğer</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Açıklama</label>
                  <textarea name="aciklama" rows={2} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Fotoğraflar (JPEG/PNG/WebP)</label>
                  <input
                    type="file"
                    name="photos"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className={inputCls}
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={!draftHazard} className={btnPrimary}>
                    Kaydet
                  </button>
                  <button type="button" onClick={resetDrafts} className={btnSecondary}>
                    Vazgeç
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        <div className="rounded-lg border border-kb-border bg-kb-surface-raised p-4 shadow-sm text-xs text-kb-muted space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-kb-muted">Gösterim</p>
          <p><span className="mr-1 inline-block h-2 w-4 rounded-sm align-middle" style={{ background: "#16a34a" }} /> Asfalt tamamlandı</p>
          <p><span className="mr-1 inline-block h-2 w-4 rounded-sm align-middle" style={{ background: "#f59e0b" }} /> Asfalt devam ediyor</p>
          <p><span className="mr-1 inline-block w-4 align-middle" style={{ borderTop: "3px dashed #64748b" }} /> Asfalt planlandı (kesikli)</p>
          <p><span className="mr-1 inline-block h-3 w-3 rounded-full align-middle" style={{ background: "#dc2626" }} /> Çukur</p>
          <p><span className="mr-1 inline-block h-3 w-3 rounded-full align-middle" style={{ background: "#ea580c" }} /> Engel</p>
          <p><span className="mr-1 inline-block h-3 w-3 rounded-full align-middle" style={{ background: "#2563eb" }} /> Şikayet</p>
        </div>
      </aside>
      </div>

      <RoadMapTables
        roads={roads}
        hazards={hazards}
        complaints={complaints}
        canEdit={canEdit}
        pending={pending}
        onFocusRoad={focusRoad}
        onEditRoad={(r) => {
          startEditRoad(r);
          focusRoad(r);
        }}
        onDeleteRoad={deleteRoad}
        onFocusHazard={(h) => focusPoint(h.lat, h.lng)}
        onToggleHazard={toggleHazardDurum}
        onDeleteHazard={deleteHazard}
        onFocusComplaint={(c) => focusPoint(c.lat, c.lng)}
      />
    </div>
  );
}
