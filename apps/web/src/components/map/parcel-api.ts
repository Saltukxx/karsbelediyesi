/** /api/ops/parsel istemci yardımcıları ve DTO tipleri */

export type ParcelGeometryDto =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

export interface ParcelDto {
  id: string;
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
  geometri: ParcelGeometryDto;
  lat: number;
  lng: number;
  kaynak: "cache" | "tkgm";
  sorgulandi: string;
}

export interface IdariBirimDto {
  id: number;
  ad: string;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw e;
    throw new Error("Sunucuya ulaşılamadı");
  }
  const data = (await res.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!res.ok) {
    throw new Error(
      (data as { error?: string } | null)?.error ?? "Sorgu başarısız oldu",
    );
  }
  if (data === null) throw new Error("Sunucu geçersiz yanıt döndürdü");
  return data;
}

export function parselByKoordinat(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<ParcelDto> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  return getJson<ParcelDto>(`/api/ops/parsel?${params}`, signal);
}

export function parselByAdaParsel(
  mahalleId: number,
  ada: string,
  parsel: string,
  refresh = false,
): Promise<ParcelDto> {
  const params = new URLSearchParams({
    mahalleId: String(mahalleId),
    ada,
    parsel,
  });
  if (refresh) params.set("refresh", "1");
  return getJson<ParcelDto>(`/api/ops/parsel?${params}`);
}

export async function ilceListesi(): Promise<IdariBirimDto[]> {
  const data = await getJson<{ items: IdariBirimDto[] }>(
    "/api/ops/parsel?liste=ilce",
  );
  return data.items;
}

export async function mahalleListesi(
  ilceId: number,
): Promise<IdariBirimDto[]> {
  const data = await getJson<{ items: IdariBirimDto[] }>(
    `/api/ops/parsel?ilceId=${ilceId}`,
  );
  return data.items;
}

/**
 * GeoJSON [lng, lat] geometrisini Leaflet Polygon positions yapısına çevirir.
 * Polygon → halka dizileri (delikler dahil), MultiPolygon → poligon dizisi.
 */
export function geometriToLeafletPositions(
  geom: ParcelGeometryDto,
): [number, number][][] | [number, number][][][] {
  const ringToLatLngs = (ring: number[][]): [number, number][] =>
    ring.map(([lng, lat]) => [lat, lng] as [number, number]);
  if (geom.type === "Polygon") {
    return geom.coordinates.map(ringToLatLngs);
  }
  return geom.coordinates.map((polygon) => polygon.map(ringToLatLngs));
}

export function parcelEtiket(p: ParcelDto): string {
  return `${p.mahalleAd} ${p.adaNo === "0" ? "" : `${p.adaNo} ada `}${p.parselNo} parsel`;
}
