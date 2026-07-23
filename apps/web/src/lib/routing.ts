import { kusUcusuKm } from "@/lib/location";

/**
 * OSRM public API ile iki nokta arası yol rotası.
 * Public sunucunun kullanım limiti düşüktür; hata/timeout durumunda
 * kuş uçuşu (haversine) tahminine düşülür ve `tahmini: true` işaretlenir.
 */

const OSRM_BASE = process.env.OSRM_URL ?? "https://router.project-osrm.org";
const TIMEOUT_MS = 6_000;
const MAX_DENEME = 3;
/** Şehir içi ortalama hız (km/sa) — kuş uçuşu fallback süre tahmini için */
const ORTALAMA_HIZ_KMH = 30;
/** Kuş uçuşu → yol mesafesi düzeltme çarpanı */
const YOL_KATSAYISI = 1.3;

export interface YolRotasi {
  /** [[lat,lng], ...] — Leaflet/MapKit konvansiyonu */
  koordinatlar: [number, number][];
  mesafeKm: number;
  sureDk: number;
  /** true ise OSRM alınamadı, kuş uçuşu tahmini */
  tahmini: boolean;
}

interface OsrmResponse {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
  }>;
}

function bekle(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function kusUcusuRota(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): YolRotasi {
  const mesafeKm = kusUcusuKm(fromLat, fromLng, toLat, toLng) * YOL_KATSAYISI;
  return {
    koordinatlar: [
      [fromLat, fromLng],
      [toLat, toLng],
    ],
    mesafeKm: Math.round(mesafeKm * 100) / 100,
    sureDk: Math.round((mesafeKm / ORTALAMA_HIZ_KMH) * 60 * 10) / 10,
    tahmini: true,
  };
}

/** Yol rotası: OSRM (retry'lı), olmazsa kuş uçuşu tahmini. Hata fırlatmaz. */
export async function yolRotasi(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<YolRotasi> {
  // OSRM lng,lat sırası bekler
  const url = `${OSRM_BASE}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;

  for (let deneme = 1; deneme <= MAX_DENEME; deneme++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { Accept: "application/json" },
      });
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`OSRM ${res.status}`);
      }
      if (!res.ok) break; // 4xx: tekrar denemenin anlamı yok
      const data = (await res.json()) as OsrmResponse;
      const route = data.routes?.[0];
      if (data.code !== "Ok" || !route) break;

      return {
        // GeoJSON [lng,lat] → [lat,lng]
        koordinatlar: route.geometry.coordinates.map(
          ([lng, lat]) => [lat, lng] as [number, number],
        ),
        mesafeKm: Math.round((route.distance / 1000) * 100) / 100,
        sureDk: Math.round((route.duration / 60) * 10) / 10,
        tahmini: false,
      };
    } catch {
      if (deneme < MAX_DENEME) await bekle(700 * deneme);
    }
  }

  return kusUcusuRota(fromLat, fromLng, toLat, toLng);
}
