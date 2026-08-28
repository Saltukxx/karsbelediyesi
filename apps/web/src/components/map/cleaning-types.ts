export type TemizlikOperasyonTipDto = "SUPURME" | "YIKAMA" | "KARMA";

export const TEMIZLIK_OPERASYON_TIP_LABELS: Record<TemizlikOperasyonTipDto, string> = {
  SUPURME: "Süpürme",
  YIKAMA: "Yıkama",
  KARMA: "Karma",
};

export interface CleaningOperationDto {
  id: string;
  tip: TemizlikOperasyonTipDto;
  /** ISO */
  baslangic: string;
  bitis: string | null;
  arac: string | null;
  sofor: string | null;
  notlar: string | null;
}

export interface CleaningRouteDto {
  id: string;
  ad: string;
  koordinatlar: [number, number][];
  /** 1 = en yüksek öncelik */
  oncelik: number;
  aktif: boolean;
  notlar: string | null;
  /** Son operasyon veya dispatch görevi (ISO) — hiç yoksa null */
  sonGorev: string | null;
  /** Son 5 operasyon (yeniden eskiye) */
  sonOperasyonlar: CleaningOperationDto[];
}
