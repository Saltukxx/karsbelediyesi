"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMapEvents,
} from "react-leaflet";
import {
  latLngBounds,
  type LeafletMouseEvent,
  type Map as LeafletMap,
} from "leaflet";
import { format } from "date-fns";
import "leaflet/dist/leaflet.css";
import {
  copRotaGuncelle,
  copRotaKaydet,
  copRotaSil,
  copToplamaKaydet,
  copToplamaSil,
} from "@/lib/actions/cop";
import { dispatchOnerAction } from "@/lib/actions/dispatch";
import { btnPrimary, btnSecondary, inputCls, labelCls } from "@/lib/ui";
import { formatLength, roadLengthMeters } from "@/components/map/road-map-geo";
import { BASEMAPS, KARS_CENTER, type Basemap } from "@/components/map/basemaps";
import {
  COP_DURUM_LABEL,
  COP_DURUM_RENK,
  GUN_LABELS,
  copDurumu,
  type WasteRouteDto,
} from "@/components/map/waste-types";
import type { WinterDriverDto, WinterVehicleDto } from "@/components/map/winter-types";

type Mode = "gezinme" | "rotaCiz";

function MapClickHandler({ onClick }: { onClick: (e: LeafletMouseEvent) => void }) {
  useMapEvents({ click: onClick });
  return null;
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function gunlerText(gunler: number[]): string {
  return gunler.map((g) => GUN_LABELS[g] ?? g).join(", ");
}

export default function WasteMap({
  routes,
  vehicles,
  drivers,
  canEdit,
}: {
  routes: WasteRouteDto[];
  vehicles: WinterVehicleDto[];
  drivers: WinterDriverDto[];
  canEdit: boolean;
}) {
  const [mode, setMode] = useState<Mode>("gezinme");
  const [basemap, setBasemap] = useState<Basemap>("sokak");
  const [draftPoints, setDraftPoints] = useState<[number, number][]>([]);
  const [editRouteId, setEditRouteId] = useState<string | null>(null);
  const [opRouteId, setOpRouteId] = useState<string>("");
  const [hoverRouteId, setHoverRouteId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const mapRef = useRef<LeafletMap | null>(null);
  const routeFormRef = useRef<HTMLFormElement>(null);
  const opFormRef = useRef<HTMLFormElement>(null);

  const now = useMemo(() => Date.now(), []);

  const editingRoute = editRouteId
    ? routes.find((r) => r.id === editRouteId) ?? null
    : null;

  const siraliRotalar = useMemo(
    () =>
      [...routes].sort((a, b) => {
        if (a.aktif !== b.aktif) return a.aktif ? -1 : 1;
        if (a.oncelik !== b.oncelik) return a.oncelik - b.oncelik;
        return a.ad.localeCompare(b.ad, "tr");
      }),
    [routes],
  );

  const draftLength = roadLengthMeters(draftPoints);

  function handleMapClick(e: LeafletMouseEvent) {
    if (!canEdit || mode !== "rotaCiz") return;
    setDraftPoints((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
  }

  function resetDrafts() {
    setDraftPoints([]);
    setEditRouteId(null);
    setMode("gezinme");
  }

  function startEditRoute(route: WasteRouteDto) {
    mapRef.current?.closePopup();
    setDraftPoints(route.koordinatlar);
    setEditRouteId(route.id);
    setMode("rotaCiz");
  }

  async function submitRoute(formData: FormData) {
    formData.set("koordinatlar", JSON.stringify(draftPoints));
    if (editRouteId) {
      formData.set("id", editRouteId);
      await copRotaGuncelle(formData);
    } else {
      await copRotaKaydet(formData);
    }
    routeFormRef.current?.reset();
    resetDrafts();
  }

  async function submitCollection(formData: FormData) {
    await copToplamaKaydet(formData);
    opFormRef.current?.reset();
    setOpRouteId("");
  }

  function deleteRoute(id: string) {
    if (!window.confirm("Bu rota ve tüm toplama kayıtları silinsin mi?")) return;
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => copRotaSil(fd));
  }

  function toggleAktif(route: WasteRouteDto) {
    const fd = new FormData();
    fd.set("id", route.id);
    fd.set("aktif", route.aktif ? "false" : "true");
    startTransition(() => copRotaGuncelle(fd));
  }

  function deleteCollection(id: string) {
    if (!window.confirm("Toplama kaydı silinsin mi?")) return;
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => copToplamaSil(fd));
  }

  function focusRoute(r: WasteRouteDto) {
    if (r.koordinatlar.length > 0) {
      mapRef.current?.fitBounds(latLngBounds(r.koordinatlar), { padding: [40, 40] });
    }
  }

  function selectCollectionRoute(routeId: string) {
    mapRef.current?.closePopup();
    setOpRouteId(routeId);
    opFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function enYakinAracIste(routeId: string) {
    mapRef.current?.closePopup();
    startTransition(async () => {
      const oneri = await dispatchOnerAction("COP", routeId);
      if (!oneri) {
        window.alert(
          "Uygun araç bulunamadı (müsait ve taze konumlu araç yok). Şoförlerin konum paylaşımını kontrol edin.",
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="kb-map relative min-h-[480px] flex-1 overflow-hidden rounded-xl border border-kb-border shadow-md">
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

          {routes
            .filter((r) => r.id !== editRouteId)
            .map((r) => {
              const durum = copDurumu(r, now);
              const weight = r.oncelik === 1 ? 7 : r.oncelik === 2 ? 5 : 4;
              return (
                <Polyline
                  key={r.id}
                  positions={r.koordinatlar}
                  pathOptions={{
                    color: r.aktif ? COP_DURUM_RENK[durum] : "#94a3b8",
                    weight: hoverRouteId === r.id ? weight + 2 : weight,
                    opacity: r.aktif ? 0.9 : 0.6,
                    dashArray: r.aktif ? undefined : "10 10",
                    lineCap: "round",
                    lineJoin: "round",
                  }}
                  eventHandlers={{
                    mouseover: () => setHoverRouteId(r.id),
                    mouseout: () => setHoverRouteId(null),
                  }}
                >
                  <Tooltip sticky>
                    {r.ad} — {gunlerText(r.gunler)} — {COP_DURUM_LABEL[durum]}
                  </Tooltip>
                  <Popup maxWidth={320}>
                    <div className="space-y-1.5 text-sm">
                      <p className="font-semibold">
                        {r.ad}{" "}
                        <span className="text-xs font-normal text-gray-500">
                          ({gunlerText(r.gunler)}, öncelik {r.oncelik}
                          {r.aktif ? "" : ", pasif"})
                        </span>
                      </p>
                      <p className="text-xs text-gray-600">
                        Uzunluk: {formatLength(roadLengthMeters(r.koordinatlar))} —{" "}
                        {COP_DURUM_LABEL[durum]}
                      </p>
                      {r.notlar && <p className="text-xs">{r.notlar}</p>}
                      {r.sonToplamalar.length > 0 ? (
                        <div>
                          <p className="text-xs font-semibold">Son toplamalar</p>
                          <ul className="mt-0.5 space-y-0.5">
                            {r.sonToplamalar.map((o) => (
                              <li key={o.id} className="flex items-center gap-2 text-xs">
                                <span>
                                  {format(new Date(o.baslangic), "dd.MM HH:mm")}
                                  {o.arac ? ` · ${o.arac}` : ""}
                                  {o.sofor ? ` · ${o.sofor}` : ""}
                                </span>
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => deleteCollection(o.id)}
                                    disabled={pending}
                                    className="text-red-600 hover:underline"
                                  >
                                    sil
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">Henüz toplama kaydı yok.</p>
                      )}
                      {canEdit && (
                        <div className="flex flex-wrap gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() => selectCollectionRoute(r.id)}
                            className="text-xs font-semibold text-kb-navy hover:underline"
                          >
                            Toplama kaydet
                          </button>
                          <button
                            type="button"
                            onClick={() => enYakinAracIste(r.id)}
                            disabled={pending}
                            className="text-xs font-semibold text-emerald-700 hover:underline"
                          >
                            En yakın aracı öner
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditRoute(r)}
                            disabled={pending}
                            className="text-xs font-semibold text-kb-navy hover:underline"
                          >
                            Düzenle
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleAktif(r)}
                            disabled={pending}
                            className="text-xs font-semibold text-kb-navy hover:underline"
                          >
                            {r.aktif ? "Pasifleştir" : "Aktifleştir"}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRoute(r.id)}
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
              );
            })}

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
        </MapContainer>
      </div>

      <aside className="w-full shrink-0 space-y-4 lg:w-96">
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

        {canEdit && (
          <div className="rounded-lg border border-kb-border bg-kb-surface-raised p-4 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-kb-muted">
              Toplama kaydı
            </p>
            <form ref={opFormRef} action={submitCollection} className="space-y-3">
              <div>
                <label className={labelCls}>Rota *</label>
                <select
                  name="routeId"
                  required
                  value={opRouteId}
                  onChange={(e) => setOpRouteId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— Seçiniz —</option>
                  {siraliRotalar
                    .filter((r) => r.aktif)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        [Ö{r.oncelik}] {r.ad}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Araç</label>
                <select name="vehicleId" className={inputCls}>
                  <option value="">— Seçiniz —</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plaka} — {v.tip ?? v.ad ?? ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Şoför</label>
                <select name="driverId" className={inputCls}>
                  <option value="">— Seçiniz —</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Başlangıç *</label>
                  <input
                    name="baslangic"
                    type="datetime-local"
                    required
                    defaultValue={toLocalInputValue(new Date())}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Bitiş</label>
                  <input name="bitis" type="datetime-local" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Not</label>
                <input name="notlar" className={inputCls} />
              </div>
              <button type="submit" className={btnPrimary}>
                Toplamayı kaydet
              </button>
            </form>
          </div>
        )}

        {canEdit && (
          <div className="rounded-lg border border-kb-border bg-kb-surface-raised p-4 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-kb-muted">
              Rota çizimi
            </p>
            <button
              type="button"
              onClick={() => {
                setDraftPoints([]);
                setEditRouteId(null);
                setMode(mode === "rotaCiz" ? "gezinme" : "rotaCiz");
              }}
              className={
                mode === "rotaCiz"
                  ? "inline-flex items-center justify-center gap-2 rounded-md bg-kb-navy text-white px-3 py-1.5 text-sm font-semibold"
                  : btnSecondary
              }
            >
              Rota çiz
            </button>

            {mode === "rotaCiz" && (
              <form
                key={editRouteId ?? "yeni"}
                ref={routeFormRef}
                action={submitRoute}
                className="mt-4 space-y-3"
              >
                {editingRoute && (
                  <p className="rounded bg-kb-surface px-2 py-1 text-xs font-semibold text-kb-navy">
                    &quot;{editingRoute.ad}&quot; düzenleniyor
                  </p>
                )}
                <p className="text-xs text-kb-muted">
                  Haritaya tıklayarak güzergaha nokta ekleyin — {draftPoints.length} nokta
                  {draftPoints.length >= 2 && `, ${formatLength(draftLength)}`}.
                </p>
                {draftPoints.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDraftPoints((p) => p.slice(0, -1))}
                    className={btnSecondary}
                  >
                    Son noktayı geri al
                  </button>
                )}
                <div>
                  <label className={labelCls}>Rota adı *</label>
                  <input
                    name="ad"
                    required
                    defaultValue={editingRoute?.ad}
                    className={inputCls}
                    placeholder="Örn. Merkez mahalle konteynerleri"
                  />
                </div>
                <div>
                  <label className={labelCls}>Toplama günleri *</label>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1.5 text-sm text-kb-ink">
                    {Object.entries(GUN_LABELS).map(([num, label]) => (
                      <label key={num} className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          name="gunler"
                          value={num}
                          defaultChecked={editingRoute?.gunler.includes(Number(num))}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Öncelik</label>
                  <select
                    name="oncelik"
                    defaultValue={editingRoute?.oncelik ?? 2}
                    className={inputCls}
                  >
                    <option value="1">1 — Merkez / yoğun</option>
                    <option value="2">2 — Normal</option>
                    <option value="3">3 — Düşük</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Notlar</label>
                  <textarea
                    name="notlar"
                    rows={2}
                    defaultValue={editingRoute?.notlar ?? undefined}
                    className={inputCls}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={draftPoints.length < 2}
                    className={btnPrimary}
                  >
                    {editingRoute ? "Güncelle" : "Kaydet"}
                  </button>
                  <button type="button" onClick={resetDrafts} className={btnSecondary}>
                    Vazgeç
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        <div className="rounded-lg border border-kb-border bg-kb-surface-raised p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-kb-muted">
            Rotalar ({routes.length})
          </p>
          {siraliRotalar.length === 0 && (
            <p className="text-xs text-kb-muted">Henüz rota tanımlanmadı.</p>
          )}
          <ul className="space-y-1.5">
            {siraliRotalar.map((r) => {
              const durum = copDurumu(r, now);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => focusRoute(r)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-kb-surface"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        background: r.aktif ? COP_DURUM_RENK[durum] : "#94a3b8",
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{r.ad}</span>{" "}
                      <span className="text-xs text-kb-muted">{gunlerText(r.gunler)}</span>
                    </span>
                    <span className="shrink-0 text-xs text-kb-muted">
                      {r.aktif ? COP_DURUM_LABEL[durum] : "pasif"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="space-y-1.5 rounded-lg border border-kb-border bg-kb-surface-raised p-4 text-xs text-kb-muted shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-kb-muted">
            Gösterim
          </p>
          <p>
            <span className="mr-1 inline-block h-2 w-4 rounded-sm align-middle" style={{ background: COP_DURUM_RENK.toplandi }} />{" "}
            Bugün toplandı
          </p>
          <p>
            <span className="mr-1 inline-block h-2 w-4 rounded-sm align-middle" style={{ background: COP_DURUM_RENK.bekliyor }} />{" "}
            Bugün toplama günü, henüz toplanmadı
          </p>
          <p>
            <span className="mr-1 inline-block h-2 w-4 rounded-sm align-middle" style={{ background: COP_DURUM_RENK.gunuDegil }} />{" "}
            Bugün toplama günü değil
          </p>
          <p>
            <span className="mr-1 inline-block w-4 align-middle" style={{ borderTop: "3px dashed #94a3b8" }} />{" "}
            Pasif rota (kesikli)
          </p>
          <p>Çizgi kalınlığı = öncelik (kalın = yoğun bölge).</p>
        </div>
      </aside>
    </div>
  );
}
