export interface CleaningRouteDto {
  id: string;
  ad: string;
  koordinatlar: [number, number][];
  /** 1 = en yüksek öncelik */
  oncelik: number;
  aktif: boolean;
  notlar: string | null;
  /** Son dispatch görevi (ISO) — hiç yoksa null */
  sonGorev: string | null;
}
