/**
 * TKGM MEGSİS parsel sorgu istemcisi.
 *
 * Resmî/dokümante olmayan servis: parselsorgu.tkgm.gov.tr'nin kullandığı
 * uç noktalar. Referer/Origin header'ları olmadan 403 döner.
 * Rate limit riskine karşı tüm istekler global bir kuyruktan (~1 istek/sn) geçer.
 */

const TKGM_BASE = "https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api";
const TKGM_HEADERS: Record<string, string> = {
  Referer: "https://parselsorgu.tkgm.gov.tr/",
  Origin: "https://parselsorgu.tkgm.gov.tr",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
};
const TIMEOUT_MS = 12_000;
/** TKGM'ye ardışık istekler arasında bırakılan minimum süre */
const MIN_INTERVAL_MS = 1_100;
/** Kuyrukta bekleyebilecek maksimum istek — aşılırsa 429 benzeri hata */
const MAX_QUEUE = 8;

export type GeoJsonPolygon = {
  type: "Polygon";
  coordinates: number[][][];
};
export type GeoJsonMultiPolygon = {
  type: "MultiPolygon";
  coordinates: number[][][][];
};
export type ParcelGeometry = GeoJsonPolygon | GeoJsonMultiPolygon;

export interface TkgmParcel {
  ilAd: string;
  ilceAd: string;
  mahalleAd: string;
  mahalleId: number;
  adaNo: string;
  parselNo: string;
  alan: number | null;
  nitelik: string | null;
  mevkii: string | null;
  pafta: string | null;
  geometri: ParcelGeometry;
  /** Merkez nokta (lat, lng) */
  lat: number;
  lng: number;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface TkgmIdariBirim {
  id: number;
  ad: string;
}

export class TkgmError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "TkgmError";
  }
}

// ── Global istek kuyruğu (TKGM IP banını önlemek için) ──────────────

let queueTail: Promise<void> = Promise.resolve();
let queueLength = 0;
let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  if (queueLength >= MAX_QUEUE) {
    throw new TkgmError(
      "TKGM sorgu kuyruğu dolu, lütfen birkaç saniye sonra tekrar deneyin",
      429,
    );
  }
  queueLength++;
  const prev = queueTail;
  let release!: () => void;
  queueTail = new Promise<void>((r) => {
    release = r;
  });
  try {
    await prev;
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    return await fn();
  } finally {
    release();
    queueLength--;
  }
}

/** TKGM aralıklı 503 döndürebiliyor (bazen seriler halinde) — artan beklemeyle tekrar dene */
const RETRY_DELAYS_MS = [1_000, 1_800, 2_600, 3_500];

async function tkgmFetchOnce(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${TKGM_BASE}${path}`, {
      headers: TKGM_HEADERS,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new TkgmError("TKGM servisi zaman aşımına uğradı", 504);
    }
    throw new TkgmError("TKGM servisine ulaşılamadı", 502);
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 404) {
    throw new TkgmError(
      "Parsel bulunamadı (yol, göl veya sayısallaştırılmamış alan olabilir)",
      404,
    );
  }
  if (res.status === 429) {
    throw new TkgmError(
      "TKGM sorgu limiti aşıldı, lütfen biraz sonra tekrar deneyin",
      429,
    );
  }
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    throw new TkgmError(
      `TKGM servisi geçici olarak yanıt vermiyor (${res.status})`,
      503,
    );
  }
  if (!res.ok) {
    throw new TkgmError(`TKGM servisi hata döndürdü (${res.status})`, 502);
  }
  try {
    return await res.json();
  } catch {
    throw new TkgmError("TKGM servisi geçersiz yanıt döndürdü", 502);
  }
}

async function tkgmFetch(path: string): Promise<unknown> {
  return enqueue(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]);
      try {
        return await tkgmFetchOnce(path);
      } catch (e) {
        lastError = e;
        const retriable =
          e instanceof TkgmError && (e.status === 503 || e.status === 504);
        if (!retriable) throw e;
      }
    }
    throw lastError;
  });
}

// ── Normalizasyon ───────────────────────────────────────────────────

/** TKGM "1.517,05" formatındaki alanı sayıya çevirir */
function parseAlan(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const n = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
}

function isValidGeometry(g: unknown): g is ParcelGeometry {
  if (typeof g !== "object" || g === null) return false;
  const geo = g as { type?: unknown; coordinates?: unknown };
  return (
    (geo.type === "Polygon" || geo.type === "MultiPolygon") &&
    Array.isArray(geo.coordinates) &&
    geo.coordinates.length > 0
  );
}

/** Polygon/MultiPolygon üzerindeki tüm [lng, lat] noktalarını gezer */
function forEachPosition(
  geom: ParcelGeometry,
  cb: (lng: number, lat: number) => void,
): void {
  const polygons =
    geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const pos of ring) {
        if (
          Array.isArray(pos) &&
          typeof pos[0] === "number" &&
          typeof pos[1] === "number"
        ) {
          cb(pos[0], pos[1]);
        }
      }
    }
  }
}

function normalizeParcel(feature: unknown): TkgmParcel {
  const f = feature as {
    geometry?: unknown;
    properties?: Record<string, unknown>;
  };
  const props = f?.properties;
  const geom = f?.geometry;
  if (!props || !isValidGeometry(geom)) {
    throw new TkgmError("TKGM servisi beklenmeyen veri döndürdü", 502);
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  forEachPosition(geom, (lng, lat) => {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  });
  if (!Number.isFinite(minLat) || !Number.isFinite(minLng)) {
    throw new TkgmError("TKGM servisi geçersiz geometri döndürdü", 502);
  }

  const mahalleId = Number(props.mahalleId);
  const parselNo = str(props.parselNo);
  if (!Number.isFinite(mahalleId) || !parselNo) {
    throw new TkgmError("TKGM servisi eksik parsel bilgisi döndürdü", 502);
  }

  return {
    ilAd: str(props.ilAd) ?? "?",
    ilceAd: str(props.ilceAd) ?? "?",
    mahalleAd: str(props.mahalleAd) ?? "?",
    mahalleId,
    // Ada numarası olmayan (kırsal) parseller "0" olarak normalize edilir
    adaNo: str(props.adaNo) ?? "0",
    parselNo,
    alan: parseAlan(props.alan),
    nitelik: str(props.nitelik),
    mevkii: str(props.mevkii),
    pafta: str(props.pafta),
    geometri: geom,
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
    minLat,
    maxLat,
    minLng,
    maxLng,
  };
}

function normalizeIdariListe(data: unknown): TkgmIdariBirim[] {
  const features =
    typeof data === "object" && data !== null && "features" in data
      ? (data as { features: unknown }).features
      : data;
  if (!Array.isArray(features)) {
    throw new TkgmError("TKGM idari birim listesi alınamadı", 502);
  }
  const items: TkgmIdariBirim[] = [];
  for (const f of features) {
    const p = (f as { properties?: Record<string, unknown> })?.properties;
    const id = Number(p?.id);
    const ad = str(p?.text);
    if (Number.isFinite(id) && ad) items.push({ id, ad });
  }
  items.sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
  return items;
}

// ── Public API ──────────────────────────────────────────────────────

export async function parselByKoordinat(
  lat: number,
  lng: number,
): Promise<TkgmParcel> {
  const data = await tkgmFetch(`/parsel/${lat}/${lng}/`);
  return normalizeParcel(data);
}

export async function parselByAdaParsel(
  mahalleId: number,
  adaNo: string,
  parselNo: string,
): Promise<TkgmParcel> {
  const data = await tkgmFetch(
    `/parsel/${mahalleId}/${encodeURIComponent(adaNo)}/${encodeURIComponent(parselNo)}`,
  );
  return normalizeParcel(data);
}

// İdari birim listeleri nadiren değişir — süreçte bir kez çekilip tutulur
const idariCache = new Map<string, { at: number; items: TkgmIdariBirim[] }>();
const IDARI_TTL_MS = 24 * 60 * 60 * 1000;

async function idariListe(path: string): Promise<TkgmIdariBirim[]> {
  const cached = idariCache.get(path);
  if (cached && Date.now() - cached.at < IDARI_TTL_MS) return cached.items;
  const items = normalizeIdariListe(await tkgmFetch(path));
  idariCache.set(path, { at: Date.now(), items });
  return items;
}

export async function ilceListe(ilId: number): Promise<TkgmIdariBirim[]> {
  return idariListe(`/idariYapi/ilceListe/${ilId}`);
}

export async function mahalleListe(ilceId: number): Promise<TkgmIdariBirim[]> {
  return idariListe(`/idariYapi/mahalleListe/${ilceId}`);
}

/** TKGM il id'si — Kars */
export const KARS_IL_ID = 58;
