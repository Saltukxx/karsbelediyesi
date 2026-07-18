/**
 * Excel formüllerinin birebir doğrulama testleri.
 * Beklenen değerler Excel'e aynı girdiler girilerek hesaplanmıştır.
 */
import { describe, it, expect } from "vitest";
import {
  normalSaatHesapla,
  mesaiSaatHesapla,
  toplamSaatHesapla,
  aracCalismaSaatiHesapla,
  gorevSuresiSaat,
  kmFarki,
  yakitTutari,
  sikayetNoUret,
  gorevNoUret,
} from "./calculations";

describe("Personel normal saat (Excel H sütunu: 08:00-17:00, öğle 12:00-13:00 düşülür)", () => {
  it("tam gün 08:00-17:00 → 8 saat (9 - 1 öğle molası)", () => {
    expect(normalSaatHesapla("08:00", "17:00")).toBeCloseTo(8, 5);
  });
  it("08:00-12:00 (öğleden önce çıkış) → 4 saat, mola düşülmez", () => {
    expect(normalSaatHesapla("08:00", "12:00")).toBeCloseTo(4, 5);
  });
  it("08:00-12:30 → 4 saat (molanın yarısı düşer)", () => {
    expect(normalSaatHesapla("08:00", "12:30")).toBeCloseTo(4, 5);
  });
  it("13:00-17:00 (öğleden sonra giriş) → 4 saat", () => {
    expect(normalSaatHesapla("13:00", "17:00")).toBeCloseTo(4, 5);
  });
  it("07:00 girişte 08:00 öncesi sayılmaz: 07:00-17:00 → 8 saat", () => {
    expect(normalSaatHesapla("07:00", "17:00")).toBeCloseTo(8, 5);
  });
  it("18:00 çıkışta 17:00 sonrası normal sayılmaz: 08:00-18:00 → 8 saat", () => {
    expect(normalSaatHesapla("08:00", "18:00")).toBeCloseTo(8, 5);
  });
  it("09:30-16:15 → 5.75 saat (6.75 - 1 mola)", () => {
    expect(normalSaatHesapla("09:30", "16:15")).toBeCloseTo(5.75, 5);
  });
});

describe("Personel fazla mesai (Excel I sütunu: 17:00 sonrası)", () => {
  it("08:00-17:00 → 0 mesai", () => {
    expect(mesaiSaatHesapla("08:00", "17:00")).toBeCloseTo(0, 5);
  });
  it("08:00-19:30 → 2.5 saat mesai", () => {
    expect(mesaiSaatHesapla("08:00", "19:30")).toBeCloseTo(2.5, 5);
  });
  it("08:00-18:00 → 1 saat mesai", () => {
    expect(mesaiSaatHesapla("08:00", "18:00")).toBeCloseTo(1, 5);
  });
});

describe("Toplam saat (Excel J = H + I)", () => {
  it("08:00-19:00 → 8 normal + 2 mesai = 10", () => {
    expect(toplamSaatHesapla("08:00", "19:00")).toBeCloseTo(10, 5);
  });
});

describe("Araç çalışma saati (Excel: gece devri destekli)", () => {
  it("08:00-17:00 → 9 saat", () => {
    expect(aracCalismaSaatiHesapla("08:00", "17:00")).toBeCloseTo(9, 5);
  });
  it("gece devri 22:00-06:00 → 8 saat", () => {
    expect(aracCalismaSaatiHesapla("22:00", "06:00")).toBeCloseTo(8, 5);
  });
  it("23:30-00:30 → 1 saat", () => {
    expect(aracCalismaSaatiHesapla("23:30", "00:30")).toBeCloseTo(1, 5);
  });
});

describe("Görev süresi (Excel: MOD(dönüş-çıkış,1)*24)", () => {
  it("09:15-14:45 → 5.5 saat", () => {
    expect(gorevSuresiSaat("09:15", "14:45")).toBeCloseTo(5.5, 5);
  });
  it("gece devri 20:00-04:00 → 8 saat", () => {
    expect(gorevSuresiSaat("20:00", "04:00")).toBeCloseTo(8, 5);
  });
});

describe("KM farkı (Excel: girişKm - çıkışKm)", () => {
  it("125400 → 125475 = 75 km", () => {
    expect(kmFarki(125400, 125475)).toBe(75);
  });
});

describe("Yakıt tutarı (Excel: litre × birim fiyat)", () => {
  it("45.5 lt × 42.75 TL = 1945.13 TL (2 hane yuvarlama)", () => {
    expect(yakitTutari(45.5, 42.75)).toBeCloseTo(1945.13, 2);
  });
  it("100 lt × 40 TL = 4000 TL", () => {
    expect(yakitTutari(100, 40)).toBe(4000);
  });
});

describe("Numaralandırma (Excel: ŞKY-&TEXT(sıra,'0000'))", () => {
  it("şikayet no: ŞKY-2026-0001", () => {
    expect(sikayetNoUret(2026, 1)).toBe("ŞKY-2026-0001");
  });
  it("şikayet no: ŞKY-2026-0123", () => {
    expect(sikayetNoUret(2026, 123)).toBe("ŞKY-2026-0123");
  });
  it("görev no: GRV-2026-0042", () => {
    expect(gorevNoUret(2026, 42)).toBe("GRV-2026-0042");
  });
});
