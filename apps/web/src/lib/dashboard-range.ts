/**
 * Dashboard tarih aralığı hesapları — saf fonksiyonlar.
 *
 * Prisma'ya bağımlı değildir; birim testleri veritabanı olmadan çalışsın diye
 * `lib/dashboard.ts` içinden ayrı tutulur.
 */

/** Türkiye 2016'dan beri yaz saati uygulamıyor; sabit UTC+3. */
export const TR_OFFSET_MS = 3 * 60 * 60 * 1000;

export const RANGE_PRESETS = [
  { id: "7g", label: "Son 7 gün", days: 7 },
  { id: "30g", label: "Son 30 gün", days: 30 },
  { id: "90g", label: "Son 90 gün", days: 90 },
] as const;

export type RangePresetId = (typeof RANGE_PRESETS)[number]["id"];

export const DEFAULT_RANGE: RangePresetId = "30g";

export type DashboardRange = {
  /** Seçili dönemin başlangıcı (dahil) */
  bas: Date;
  /** Seçili dönemin bitişi (dahil) */
  bit: Date;
  /** Aynı uzunlukta, hemen önceki dönem */
  onceki: { bas: Date; bit: Date };
  /** Kaç günlük pencere */
  gunSayisi: number;
  /** URL'de görünen seçim */
  preset: RangePresetId | "ozel";
};

/** Verilen anın Türkiye saatiyle gün başlangıcı (UTC instant olarak). */
export function startOfDayTR(d: Date): Date {
  const shifted = new Date(d.getTime() + TR_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - TR_OFFSET_MS);
}

/** Verilen anın Türkiye saatiyle gün sonu (UTC instant olarak). */
export function endOfDayTR(d: Date): Date {
  const shifted = new Date(d.getTime() + TR_OFFSET_MS);
  shifted.setUTCHours(23, 59, 59, 999);
  return new Date(shifted.getTime() - TR_OFFSET_MS);
}

/** "2026-07-31" — Türkiye saatine göre gün anahtarı. */
export function trDayKey(d: Date): string {
  return new Date(d.getTime() + TR_OFFSET_MS).toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

function parseISODate(value: string | undefined): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(ms)) return null;
  // Girilen gün Türkiye saatiyle yorumlanır
  return new Date(ms - TR_OFFSET_MS);
}

/**
 * URL parametrelerinden aralığı çözer. Geçersiz girdide varsayılana düşer.
 *
 * `aralik=ozel` için `bas`/`bit` "YYYY-MM-DD" beklenir; ters sıradaysa
 * takas edilir.
 */
export function resolveRange(
  aralik?: string,
  bas?: string,
  bit?: string,
  now: Date = new Date(),
): DashboardRange {
  const bugunSonu = endOfDayTR(now);

  if (aralik === "ozel") {
    let basD = parseISODate(bas);
    let bitD = parseISODate(bit);
    if (basD && bitD) {
      if (basD.getTime() > bitD.getTime()) [basD, bitD] = [bitD, basD];
      const basStart = startOfDayTR(basD);
      const bitEnd = endOfDayTR(bitD);
      const gunSayisi = Math.max(
        1,
        Math.round((bitEnd.getTime() - basStart.getTime()) / (24 * 60 * 60 * 1000)),
      );
      return {
        bas: basStart,
        bit: bitEnd,
        onceki: {
          bas: startOfDayTR(addDays(basStart, -gunSayisi)),
          bit: new Date(basStart.getTime() - 1),
        },
        gunSayisi,
        preset: "ozel",
      };
    }
  }

  const preset =
    RANGE_PRESETS.find((p) => p.id === aralik) ??
    RANGE_PRESETS.find((p) => p.id === DEFAULT_RANGE)!;

  const basStart = startOfDayTR(addDays(bugunSonu, -(preset.days - 1)));

  return {
    bas: basStart,
    bit: bugunSonu,
    onceki: {
      bas: startOfDayTR(addDays(basStart, -preset.days)),
      bit: new Date(basStart.getTime() - 1),
    },
    gunSayisi: preset.days,
    preset: preset.id,
  };
}

export type Delta = {
  current: number;
  previous: number;
  /** Yüzde değişim; önceki dönem 0 ise null (oran tanımsız). */
  changePct: number | null;
};

export function makeDelta(current: number, previous: number): Delta {
  return { current, previous, changePct: pctChange(current, previous) };
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

/**
 * Aralıktaki her gün için kayıt üretir; veri olmayan günler 0 ile doldurulur.
 * Grafiğin sürekli olması için gereklidir.
 */
export function buildDailySeries<T extends Record<string, number>>(
  range: DashboardRange,
  buckets: Map<string, T>,
  bos: T,
): Array<{ gun: string } & T> {
  const out: Array<{ gun: string } & T> = [];
  const basKey = startOfDayTR(range.bas);
  for (let i = 0; i < range.gunSayisi; i++) {
    const gun = trDayKey(addDays(basKey, i));
    out.push({ gun, ...(buckets.get(gun) ?? bos) });
  }
  return out;
}

/** "31 Tem" — grafik ekseni için kısa Türkçe gün etiketi. */
export function formatDayLabel(gunKey: string): string {
  const d = new Date(`${gunKey}T12:00:00.000Z`);
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

/** "2026-07" → "Tem 2026" */
export function formatMonthLabel(ayKey: string): string {
  const d = new Date(`${ayKey}-01T12:00:00.000Z`);
  return d.toLocaleDateString("tr-TR", { month: "short", year: "numeric" });
}
