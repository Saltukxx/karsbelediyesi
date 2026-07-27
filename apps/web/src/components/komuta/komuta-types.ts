/** Haritada odaklanılacak hedef — nonce aynı hedefe tekrar tıklamayı da tetikler */
export type KomutaOdak =
  | { tur: "nokta"; lat: number; lng: number; nonce: number }
  | { tur: "rota"; koordinatlar: [number, number][]; nonce: number };
