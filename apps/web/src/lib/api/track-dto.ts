/**
 * Takip raporu DTO'ları — `RouteTrackAnalysis` JSON kolonlarının şekli.
 * Hem web haritası hem `/api/v1/tasks/[id]/takip` yanıtı bunları kullanır.
 */

export interface SapmaDto {
  /** epoch ms */
  baslangicMs: number;
  bitisMs: number;
  sureDk: number;
  maxMesafeM: number;
  lat: number;
  lng: number;
  izler: [number, number][];
}

export interface DuraklamaDto {
  lat: number;
  lng: number;
  baslangicMs: number;
  bitisMs: number;
  sureDk: number;
  rotaUzerinde: boolean;
}

export interface VeriBosluguDto {
  baslangicMs: number;
  bitisMs: number;
  sureDk: number;
}

export type TakipOlayTipi =
  | "ROTA_GIRIS"
  | "SAPMA"
  | "DURAKLAMA_ROTADA"
  | "DURAKLAMA_ROTA_DISI"
  | "VERI_BOSLUGU"
  | "ROTA_CIKIS";

/** Zaman çizelgesi satırı; etiket ve renk sunum katmanında seçilir. */
export interface TakipOlayi {
  tip: TakipOlayTipi;
  baslangicMs: number;
  /** Anlık olaylarda (rotaya giriş/çıkış) null */
  bitisMs: number | null;
  sureDk: number | null;
  maxMesafeM: number | null;
}

export interface TrackReportData {
  /** Planlanan rota [[lat,lng],...] */
  planlanan: [number, number][];
  /** Kat edilmeyen rota bölümleri */
  eksikSegmentler: [number, number][][];
  /** GPS izi [[lat,lng,tsMs,hiz|null],...] */
  iz: [number, number, number, number | null][];
  sapmalar: SapmaDto[];
  duraklamalar: DuraklamaDto[];
  veriBosluklari: VeriBosluguDto[];
  /** epoch ms — rotaya ilk giriş / son çıkış */
  rotaGirisMs: number | null;
  rotaCikisMs: number | null;
}
