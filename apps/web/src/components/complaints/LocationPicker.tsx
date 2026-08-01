"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { Loader2, MapPin, Search } from "lucide-react";
import { adresGeocodeEt } from "@/lib/actions/complaints";
import { BASEMAPS, KARS_CENTER } from "@/components/map/basemaps";
import "leaflet/dist/leaflet.css";

type Mahalle = { id: string; name: string };

function HaritaTiklama({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function GorunumuOrtala({
  lat,
  lng,
}: {
  lat: number | null;
  lng: number | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (lat == null || lng == null) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.45 });
  }, [lat, lng, map]);
  return null;
}

/**
 * Şikayet formu için harita pini. Gizli lat/lng alanlarına yazar.
 * "Adresten bul" formdaki acikAdres + neighborhoodId ile Nominatim çağırır.
 */
export function LocationPicker({
  initialLat = null,
  initialLng = null,
  mahalleler = [],
  adresFieldName = "acikAdres",
  mahalleFieldName = "neighborhoodId",
  nameLat = "lat",
  nameLng = "lng",
  height = 260,
}: {
  initialLat?: number | null;
  initialLng?: number | null;
  mahalleler?: Mahalle[];
  adresFieldName?: string;
  mahalleFieldName?: string;
  nameLat?: string;
  nameLng?: string;
  height?: number;
}) {
  const [lat, setLat] = useState<number | null>(initialLat);
  const [lng, setLng] = useState<number | null>(initialLng);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const mahalleAdiById = useMemo(
    () => new Map(mahalleler.map((m) => [m.id, m.name])),
    [mahalleler],
  );

  const pinSec = useCallback((yeniLat: number, yeniLng: number) => {
    setLat(yeniLat);
    setLng(yeniLng);
    setHata(null);
    setBilgi(null);
  }, []);

  function pinTemizle() {
    setLat(null);
    setLng(null);
    setBilgi(null);
    setHata(null);
  }

  function adrestenBul(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    const form = e.currentTarget.form;
    if (!form) {
      setHata("Form bulunamadı");
      return;
    }
    const adres =
      (form.elements.namedItem(adresFieldName) as HTMLInputElement | null)
        ?.value?.trim() ?? "";
    const mahalleId =
      (form.elements.namedItem(mahalleFieldName) as HTMLSelectElement | null)
        ?.value?.trim() ?? "";
    const mahalle = mahalleAdiById.get(mahalleId) ?? "";
    if (!adres && !mahalle) {
      setHata("Önce mahalle veya açık adres girin");
      return;
    }

    setHata(null);
    setBilgi(null);
    startTransition(async () => {
      const sonuc = await adresGeocodeEt({ adres, mahalle });
      if (!sonuc) {
        setHata("Adres bulunamadı; haritadan pin atabilirsiniz");
        return;
      }
      setLat(sonuc.lat);
      setLng(sonuc.lng);
      setBilgi(sonuc.displayName);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-kb-ink">Konum (isteğe bağlı)</div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={adrestenBul}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md border border-kb-border bg-white px-2.5 py-1.5 text-xs font-medium text-kb-ink hover:bg-kb-surface disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            Adresten bul
          </button>
          {lat != null && lng != null && (
            <button
              type="button"
              onClick={pinTemizle}
              className="rounded-md border border-kb-border px-2.5 py-1.5 text-xs text-kb-muted hover:text-kb-ink"
            >
              Pini temizle
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-kb-muted">
        Haritaya tıklayarak pin atın veya açık adresten konum bulun. WhatsApp
        konum pini kullanılmaz.
      </p>

      <input type="hidden" name={nameLat} value={lat ?? ""} />
      <input type="hidden" name={nameLng} value={lng ?? ""} />

      <MapContainer
        center={
          lat != null && lng != null ? [lat, lng] : KARS_CENTER
        }
        zoom={lat != null ? 15 : 13}
        scrollWheelZoom={false}
        className="z-0 w-full rounded-md border border-kb-border"
        style={{ height }}
      >
        <TileLayer
          url={BASEMAPS.sade.url}
          attribution={BASEMAPS.sade.attribution}
        />
        <HaritaTiklama onPick={pinSec} />
        <GorunumuOrtala lat={lat} lng={lng} />
        {lat != null && lng != null && (
          <CircleMarker
            center={[lat, lng]}
            radius={9}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: "#1e3a5f",
              fillOpacity: 1,
            }}
          />
        )}
      </MapContainer>

      {lat != null && lng != null && (
        <div className="flex items-center gap-1.5 text-xs text-kb-muted">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="tabular-nums">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </span>
        </div>
      )}
      {bilgi && <p className="text-xs text-kb-muted">{bilgi}</p>}
      {hata && <p className="text-xs text-kb-danger">{hata}</p>}
    </div>
  );
}
