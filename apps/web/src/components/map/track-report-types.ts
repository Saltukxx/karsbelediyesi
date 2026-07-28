/** Takip raporu haritası için serileştirilmiş DTO'lar */

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
