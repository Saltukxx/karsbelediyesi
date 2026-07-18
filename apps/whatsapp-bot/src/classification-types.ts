export type Classification = {
  intent: "sikayet" | "bilgi_talebi" | "durum_sorgu" | "tesekkur" | "diger";
  sikayet_turu: string | null;
  mahalle: string | null;
  adres: string | null;
  aciklama_ozeti: string | null;
  oncelik: "NORMAL" | "ACIL" | "COK_ACIL";
  guven: number;
};
