export type AsfaltDurumDto = "PLANLANDI" | "DEVAM_EDIYOR" | "TAMAMLANDI";
export type HazardTipDto = "CUKUR" | "ENGEL" | "DIGER";
export type HazardDurumDto = "ACIK" | "GIDERILDI";

export interface RoadDto {
  id: string;
  ad: string;
  koordinatlar: [number, number][];
  durum: AsfaltDurumDto;
  dokumTarihi: string | null;
  notlar: string | null;
  olusturan: string;
  createdAt: string;
}

export interface HazardDto {
  id: string;
  tip: HazardTipDto;
  lat: number;
  lng: number;
  aciklama: string | null;
  durum: HazardDurumDto;
  olusturan: string;
  tarih: string;
  photoIds: string[];
}

export interface ComplaintPinDto {
  id: string;
  sikayetNo: string;
  durum: string;
  /// Ham durum kodu (ACIK | DEVAM_EDIYOR | KAPATILDI | IPTAL) — filtreleme için
  durumKodu: string;
  lat: number;
  lng: number;
  aciklama: string | null;
}

export const ASFALT_DURUM_LABELS: Record<AsfaltDurumDto, string> = {
  PLANLANDI: "Planlandı",
  DEVAM_EDIYOR: "Devam Ediyor",
  TAMAMLANDI: "Tamamlandı",
};

export const HAZARD_TIP_LABELS: Record<HazardTipDto, string> = {
  CUKUR: "Çukur",
  ENGEL: "Engel",
  DIGER: "Diğer",
};
