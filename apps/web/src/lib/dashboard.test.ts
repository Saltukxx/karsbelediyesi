import { describe, expect, it } from "vitest";
import {
  buildDailySeries,
  endOfDayTR,
  formatDayLabel,
  makeDelta,
  pctChange,
  resolveRange,
  startOfDayTR,
  trDayKey,
  TR_OFFSET_MS,
} from "./dashboard-range";

/** 31 Temmuz 2026, TR saatiyle 22:00 (UTC 19:00) */
const NOW = new Date("2026-07-31T19:00:00.000Z");

describe("gün sınırları (Türkiye saati)", () => {
  it("gün başlangıcını TR 00:00 olarak alır", () => {
    const bas = startOfDayTR(NOW);
    // TR 00:00 = UTC 21:00 (bir önceki gün)
    expect(bas.toISOString()).toBe("2026-07-30T21:00:00.000Z");
  });

  it("gün sonunu TR 23:59:59.999 olarak alır", () => {
    expect(endOfDayTR(NOW).toISOString()).toBe("2026-07-31T20:59:59.999Z");
  });

  it("UTC gecesi TR'de ertesi güne aittir", () => {
    // UTC 31 Temmuz 22:00 → TR 1 Ağustos 01:00
    expect(trDayKey(new Date("2026-07-31T22:00:00.000Z"))).toBe("2026-08-01");
    expect(trDayKey(new Date("2026-07-31T19:00:00.000Z"))).toBe("2026-07-31");
  });

  it("gün başlangıcı ve sonu aynı güne düşer", () => {
    expect(trDayKey(startOfDayTR(NOW))).toBe("2026-07-31");
    expect(trDayKey(endOfDayTR(NOW))).toBe("2026-07-31");
  });
});

describe("resolveRange", () => {
  it("parametre yoksa 30 günü seçer", () => {
    const r = resolveRange(undefined, undefined, undefined, NOW);
    expect(r.preset).toBe("30g");
    expect(r.gunSayisi).toBe(30);
  });

  it("geçersiz aralıkta varsayılana düşer", () => {
    expect(resolveRange("saçma", undefined, undefined, NOW).preset).toBe("30g");
  });

  it("hazır aralık bugünü de içerir", () => {
    const r = resolveRange("7g", undefined, undefined, NOW);
    expect(trDayKey(r.bas)).toBe("2026-07-25");
    expect(trDayKey(r.bit)).toBe("2026-07-31");
  });

  it("önceki dönem aynı uzunlukta ve bitişik olur", () => {
    const r = resolveRange("7g", undefined, undefined, NOW);
    expect(trDayKey(r.onceki.bas)).toBe("2026-07-18");
    expect(trDayKey(r.onceki.bit)).toBe("2026-07-24");
    // Bitişik: önceki dönem seçili dönemin 1 ms öncesinde biter
    expect(r.onceki.bit.getTime()).toBe(r.bas.getTime() - 1);
    // Aynı uzunluk
    const uzunluk = (a: Date, b: Date) => b.getTime() - a.getTime();
    expect(uzunluk(r.onceki.bas, r.onceki.bit)).toBe(uzunluk(r.bas, r.bit));
  });

  it("özel aralığı gün sınırlarına yuvarlar", () => {
    const r = resolveRange("ozel", "2026-06-01", "2026-06-10", NOW);
    expect(r.preset).toBe("ozel");
    expect(r.gunSayisi).toBe(10);
    expect(trDayKey(r.bas)).toBe("2026-06-01");
    expect(trDayKey(r.bit)).toBe("2026-06-10");
    expect(trDayKey(r.onceki.bas)).toBe("2026-05-22");
    expect(trDayKey(r.onceki.bit)).toBe("2026-05-31");
  });

  it("özel aralıkta ters sıralı tarihleri takas eder", () => {
    const r = resolveRange("ozel", "2026-06-10", "2026-06-01", NOW);
    expect(trDayKey(r.bas)).toBe("2026-06-01");
    expect(trDayKey(r.bit)).toBe("2026-06-10");
  });

  it("özel aralık eksik/bozuksa varsayılana düşer", () => {
    expect(resolveRange("ozel", "2026-06-01", undefined, NOW).preset).toBe("30g");
    expect(resolveRange("ozel", "01.06.2026", "10.06.2026", NOW).preset).toBe("30g");
  });

  it("tek günlük özel aralık geçerlidir", () => {
    const r = resolveRange("ozel", "2026-06-05", "2026-06-05", NOW);
    expect(r.gunSayisi).toBe(1);
    expect(trDayKey(r.onceki.bas)).toBe("2026-06-04");
  });
});

describe("pctChange", () => {
  it("artış ve azalışı yüzde olarak verir", () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(50, 100)).toBe(-50);
    expect(pctChange(100, 100)).toBe(0);
  });

  it("önceki dönem sıfırsa oran tanımsızdır", () => {
    expect(pctChange(10, 0)).toBeNull();
    expect(pctChange(0, 0)).toBeNull();
  });

  it("tek ondalığa yuvarlar", () => {
    expect(pctChange(1, 3)).toBe(-66.7);
  });

  it("makeDelta üç alanı birlikte döner", () => {
    expect(makeDelta(8, 4)).toEqual({ current: 8, previous: 4, changePct: 100 });
  });
});

describe("buildDailySeries", () => {
  it("veri olmayan günleri sıfırla doldurur ve sırayı korur", () => {
    const range = resolveRange("7g", undefined, undefined, NOW);
    const buckets = new Map([["2026-07-28", { acilan: 3, kapanan: 1 }]]);
    const seri = buildDailySeries(range, buckets, { acilan: 0, kapanan: 0 });

    expect(seri).toHaveLength(7);
    expect(seri[0].gun).toBe("2026-07-25");
    expect(seri[6].gun).toBe("2026-07-31");
    expect(seri.find((s) => s.gun === "2026-07-28")).toEqual({
      gun: "2026-07-28",
      acilan: 3,
      kapanan: 1,
    });
    expect(seri[0]).toEqual({ gun: "2026-07-25", acilan: 0, kapanan: 0 });
  });

  it("gün sayısı kadar kayıt üretir", () => {
    const range = resolveRange("30g", undefined, undefined, NOW);
    expect(buildDailySeries(range, new Map(), { acilan: 0, kapanan: 0 })).toHaveLength(30);
  });
});

describe("etiketler", () => {
  it("gün etiketini Türkçe kısaltır", () => {
    expect(formatDayLabel("2026-07-31")).toMatch(/31/);
  });

  it("TR ofseti sabittir", () => {
    expect(TR_OFFSET_MS).toBe(3 * 60 * 60 * 1000);
  });
});
