/** ISO gün numaraları: 1=Pazartesi ... 7=Pazar */
export const GUN_LABELS: Record<number, string> = {
  1: "Pzt",
  2: "Sal",
  3: "Çar",
  4: "Per",
  5: "Cum",
  6: "Cmt",
  7: "Paz",
};

export interface WasteCollectionDto {
  id: string;
  /** ISO */
  baslangic: string;
  bitis: string | null;
  arac: string | null;
  sofor: string | null;
  notlar: string | null;
}

export interface WasteRouteDto {
  id: string;
  ad: string;
  koordinatlar: [number, number][];
  /** ISO gün numaraları [1..7] */
  gunler: number[];
  /** 1 = en yüksek öncelik */
  oncelik: number;
  aktif: boolean;
  notlar: string | null;
  /** Son toplama başlangıcı (ISO) — hiç yoksa null */
  sonToplama: string | null;
  /** Son 5 toplama (yeniden eskiye) */
  sonToplamalar: WasteCollectionDto[];
}

export type CopDurum = "toplandi" | "bekliyor" | "gunuDegil";

/** Bugün toplama günü mü ve toplandı mı? */
export function copDurumu(
  route: Pick<WasteRouteDto, "gunler" | "sonToplama">,
  now: number,
): CopDurum {
  const bugun = new Date(now);
  // getDay: 0=Pazar → ISO 7
  const isoGun = bugun.getDay() === 0 ? 7 : bugun.getDay();
  if (!route.gunler.includes(isoGun)) return "gunuDegil";
  if (!route.sonToplama) return "bekliyor";
  const son = new Date(route.sonToplama);
  const bugunBasi = new Date(now);
  bugunBasi.setHours(0, 0, 0, 0);
  return son >= bugunBasi ? "toplandi" : "bekliyor";
}

export const COP_DURUM_RENK: Record<CopDurum, string> = {
  toplandi: "#16a34a",
  bekliyor: "#dc2626",
  gunuDegil: "#64748b",
};

export const COP_DURUM_LABEL: Record<CopDurum, string> = {
  toplandi: "Bugün toplandı",
  bekliyor: "Bugün bekliyor",
  gunuDegil: "Bugün günü değil",
};
