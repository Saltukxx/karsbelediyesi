export type KomutaTip = "KIS" | "COP" | "TEMIZLIK";

/** Rozetlerde kullanılan kısa dispatch tipi adları */
export function tipKisaLabel(tip: KomutaTip): string {
  switch (tip) {
    case "KIS":
      return "Kış";
    case "COP":
      return "Çöp";
    case "TEMIZLIK":
      return "Temizlik";
    default: {
      const _exhaustive: never = tip;
      return _exhaustive;
    }
  }
}

/** Haritada odaklanılacak hedef — nonce aynı hedefe tekrar tıklamayı da tetikler */
export type KomutaOdak =
  | { tur: "nokta"; lat: number; lng: number; nonce: number }
  | { tur: "rota"; koordinatlar: [number, number][]; nonce: number };
