export type KisRotaTipDto = "KAR_KUREME" | "TUZLAMA" | "KARMA";
export type KisOperasyonTipDto = "KURUME" | "TUZLAMA" | "KARMA";

export const ROTA_TIP_LABELS: Record<KisRotaTipDto, string> = {
  KAR_KUREME: "Kar Küreme",
  TUZLAMA: "Tuzlama",
  KARMA: "Karma",
};

export const OPERASYON_TIP_LABELS: Record<KisOperasyonTipDto, string> = {
  KURUME: "Küreme",
  TUZLAMA: "Tuzlama",
  KARMA: "Karma",
};

export interface WinterOperationDto {
  id: string;
  tip: KisOperasyonTipDto;
  /** ISO */
  baslangic: string;
  bitis: string | null;
  tuzKg: number | null;
  arac: string | null;
  sofor: string | null;
  notlar: string | null;
}

export interface WinterRouteDto {
  id: string;
  ad: string;
  koordinatlar: [number, number][];
  tip: KisRotaTipDto;
  /** 1 = en yüksek öncelik */
  oncelik: number;
  aktif: boolean;
  notlar: string | null;
  /** Son operasyon başlangıcı (ISO) — hiç yoksa null */
  sonOperasyon: string | null;
  /** Son 5 operasyon (yeniden eskiye) */
  sonOperasyonlar: WinterOperationDto[];
}

export interface WinterVehicleDto {
  id: string;
  plaka: string;
  ad: string | null;
  tip: string | null;
}

export interface WinterDriverDto {
  id: string;
  name: string;
}

export interface WinterMaterialDto {
  id: string;
  kod: string;
  ad: string;
  birim: string;
  stok: number;
}

export type Tazelik = "taze" | "orta" | "eski";

/** Son operasyondan geçen süreye göre tazelik: yeşil < 4 sa, sarı 4–12 sa, kırmızı > 12 sa / hiç */
export function rotaTazelik(sonOperasyon: string | null, now: number): Tazelik {
  if (!sonOperasyon) return "eski";
  const saat = (now - new Date(sonOperasyon).getTime()) / 3_600_000;
  if (saat < 4) return "taze";
  if (saat < 12) return "orta";
  return "eski";
}

export const TAZELIK_RENK: Record<Tazelik, string> = {
  taze: "#16a34a",
  orta: "#f59e0b",
  eski: "#dc2626",
};

export const TAZELIK_LABEL: Record<Tazelik, string> = {
  taze: "< 4 sa",
  orta: "4–12 sa",
  eski: "> 12 sa",
};
