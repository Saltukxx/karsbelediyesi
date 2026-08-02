"use client";

import { useEffect, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import { latLngBounds } from "leaflet";
import { format } from "date-fns";
import "leaflet/dist/leaflet.css";
import { BASEMAPS, KARS_CENTER, type Basemap } from "@/components/map/basemaps";
import type {
  KomutaAracDto,
  KomutaGecikenRotaDto,
  KomutaSikayetPinDto,
} from "@/lib/komuta";
import type { KomutaOdak } from "@/components/komuta/komuta-types";

const BUCKET_RENK: Record<KomutaSikayetPinDto["bucket"], string> = {
  lt24: "#eab308",
  d1to3: "#f97316",
  gt3: "#dc2626",
};

const BUCKET_LABEL: Record<KomutaSikayetPinDto["bucket"], string> = {
  lt24: "24 saatten yeni",
  d1to3: "1–3 gün",
  gt3: "3 günden eski",
};

/** Panelden tıklanan hedefe uçuş */
function OdakKontrol({ odak }: { odak: KomutaOdak | null }) {
  const map = useMap();
  useEffect(() => {
    if (!odak) return;
    if (odak.tur === "nokta") {
      map.flyTo([odak.lat, odak.lng], Math.max(map.getZoom(), 15));
    } else if (odak.koordinatlar.length > 0) {
      map.flyToBounds(latLngBounds(odak.koordinatlar), { padding: [40, 40] });
    }
  }, [map, odak]);
  return null;
}

export default function KomutaMap({
  araclar,
  sikayetler,
  gecikenRotalar,
  odak,
}: {
  araclar: KomutaAracDto[];
  sikayetler: KomutaSikayetPinDto[];
  gecikenRotalar: KomutaGecikenRotaDto[];
  odak: KomutaOdak | null;
}) {
  const [basemap, setBasemap] = useState<Basemap>("sokak");
  const konumluAraclar = araclar.filter(
    (a): a is KomutaAracDto & { lat: number; lng: number } =>
      a.lat != null && a.lng != null,
  );

  return (
    // Leaflet katmanları z-index 200–1000 kullanır; uygulama overlay'lerine taşmasın.
    <div className="relative isolate z-0 h-full overflow-hidden rounded-lg border border-kb-border">
      <div className="absolute right-2 top-2 z-[1000] flex gap-1 rounded-md bg-white/90 p-1 shadow">
        {(Object.keys(BASEMAPS) as Basemap[]).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBasemap(b)}
            className={`rounded px-2 py-1 text-xs font-medium ${
              basemap === b ? "bg-kb-navy text-white" : "text-kb-ink hover:bg-kb-surface"
            }`}
          >
            {BASEMAPS[b].label}
          </button>
        ))}
      </div>

      <div className="absolute bottom-2 left-2 z-[1000] rounded-md bg-white/90 px-2.5 py-1.5 text-[0.7rem] leading-5 shadow">
        <span className="mr-3">
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          canlı araç
        </span>
        <span className="mr-3">
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-gray-400" />
          bayat konum
        </span>
        <span className="mr-3">
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: BUCKET_RENK.gt3 }} />
          şikayet (SLA rengine göre)
        </span>
        <span>
          <span className="mr-1 inline-block h-0.5 w-4 align-middle" style={{ background: "#dc2626" }} />
          geciken rota
        </span>
      </div>

      <MapContainer
        center={KARS_CENTER}
        zoom={13}
        className="z-0 h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          url={BASEMAPS[basemap].url}
          attribution={BASEMAPS[basemap].attribution}
        />
        <OdakKontrol odak={odak} />

        {gecikenRotalar.map((r) =>
          r.koordinatlar.length > 1 ? (
            <Polyline
              key={`${r.tip}:${r.id}`}
              positions={r.koordinatlar}
              pathOptions={{
                color: r.tip === "KIS" ? "#2563eb" : "#dc2626",
                weight: 5,
                opacity: 0.8,
                dashArray: "8 6",
              }}
            >
              <Tooltip sticky>
                {r.tip === "KIS" ? "Kış" : "Çöp"} · {r.ad} —{" "}
                {r.tip === "KIS"
                  ? `öncelik-${r.oncelik}, ${r.esikSaat} saattir işlem yok`
                  : "bugün toplanmadı"}
              </Tooltip>
            </Polyline>
          ) : null,
        )}

        {sikayetler.map((s) => (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lng]}
            radius={7}
            pathOptions={{
              color: BUCKET_RENK[s.bucket],
              fillColor: BUCKET_RENK[s.bucket],
              fillOpacity: 0.85,
              weight: 1.5,
            }}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{s.sikayetNo}</p>
                <p className="text-xs">
                  {BUCKET_LABEL[s.bucket]} · kayıt{" "}
                  {format(new Date(s.kayitTarihi), "dd.MM.yyyy HH:mm")}
                </p>
                {s.aciklama && <p className="mt-1 text-xs">{s.aciklama}</p>}
                <a
                  href={`/sikayetler/${s.id}`}
                  className="mt-1 block text-xs font-medium text-blue-700 underline"
                >
                  Şikayeti aç
                </a>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {konumluAraclar.map((a) => (
          <CircleMarker
            key={a.id}
            center={[a.lat, a.lng]}
            radius={9}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: a.taze ? "#059669" : "#9ca3af",
              fillOpacity: 1,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              {a.plaka}
            </Tooltip>
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{a.plaka}</p>
                {a.tip && <p className="text-xs">{a.tip}</p>}
                <p className="text-xs">
                  Konum:{" "}
                  {a.konumZamani
                    ? format(new Date(a.konumZamani), "dd.MM HH:mm")
                    : "—"}
                  {a.taze ? " (canlı)" : " (bayat)"}
                </p>
                <p className="text-xs">
                  {a.aktifGorev
                    ? `Görevde: ${a.aktifGorev.gorevNo}${
                        a.aktifGorev.tanim ? ` — ${a.aktifGorev.tanim}` : ""
                      }`
                    : "Boşta"}
                </p>
                {a.rotada != null && (
                  <p
                    className={`text-xs font-semibold ${
                      a.rotada ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {a.rotada ? "Rotada" : `Rota dışı (${a.rotaUzaklikM} m)`}
                  </p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
