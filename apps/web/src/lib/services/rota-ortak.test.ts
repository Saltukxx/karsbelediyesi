import { describe, expect, it } from "vitest";
import {
  koordinatlarAlani,
  oncelikAlani,
  opsiyonelOncelik,
  zamanAraligi,
} from "./rota-ortak";

describe("koordinatlarAlani", () => {
  it("JSON dizisini olduğu gibi kabul eder (mobil istemci)", () => {
    expect(
      koordinatlarAlani.parse([
        [40.6, 43.09],
        [40.61, 43.1],
      ]),
    ).toEqual([
      [40.6, 43.09],
      [40.61, 43.1],
    ]);
  });

  it("web formundan gelen JSON metnini çözer", () => {
    expect(koordinatlarAlani.parse("[[40.6,43.09],[40.61,43.1]]")).toEqual([
      [40.6, 43.09],
      [40.61, 43.1],
    ]);
  });

  it("bozuk JSON'u reddeder", () => {
    expect(() => koordinatlarAlani.parse("[[40.6,")).toThrow(/Koordinat formatı/);
  });

  it("tek noktalı rotayı reddeder", () => {
    expect(() => koordinatlarAlani.parse([[40.6, 43.09]])).toThrow(/En az 2/);
  });

  it("aralık dışı enlemi reddeder", () => {
    expect(() =>
      koordinatlarAlani.parse([
        [95, 43.09],
        [40.61, 43.1],
      ]),
    ).toThrow();
  });
});

describe("oncelikAlani", () => {
  it("gönderilmediğinde varsayılan 2 olur", () => {
    expect(oncelikAlani.parse(undefined)).toBe(2);
  });

  it("1-3 aralığına sıkıştırır", () => {
    expect(oncelikAlani.parse("0")).toBe(1);
    expect(oncelikAlani.parse(9)).toBe(3);
  });

  it("ondalık değeri yuvarlar", () => {
    expect(oncelikAlani.parse("2,4")).toBe(2);
  });

  it("opsiyonel biçimi gönderilmediğinde undefined bırakır", () => {
    expect(opsiyonelOncelik.parse(undefined)).toBeUndefined();
  });
});

describe("zamanAraligi", () => {
  it("başlangıç yoksa şimdiyi kullanır", () => {
    const once = Date.now();
    const { baslangic } = zamanAraligi({});
    expect(baslangic.getTime()).toBeGreaterThanOrEqual(once);
  });

  it("bitiş başlangıçtan önceyse hata verir", () => {
    expect(() =>
      zamanAraligi({
        baslangic: new Date("2026-01-10T10:00:00Z"),
        bitis: new Date("2026-01-10T09:00:00Z"),
      }),
    ).toThrow(/Bitiş başlangıçtan önce/);
  });

  it("geçerli aralığı olduğu gibi döner", () => {
    const baslangic = new Date("2026-01-10T10:00:00Z");
    const bitis = new Date("2026-01-10T12:00:00Z");
    expect(zamanAraligi({ baslangic, bitis })).toEqual({ baslangic, bitis });
  });
});
