import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  enumAlani,
  formVerisi,
  mantiksalAlan,
  opsiyonelMetin,
  opsiyonelSayi,
  opsiyonelTarih,
  saatAlani,
  sayiAlani,
  tarihAlani,
} from "./base";

const Durum = { AKTIF: "AKTIF", IZINLI: "IZINLI" } as const;

describe("sayiAlani", () => {
  it("JSON number'ı olduğu gibi kabul eder", () => {
    expect(sayiAlani().parse(12.5)).toBe(12.5);
  });

  it("FormData string'ini sayıya çevirir", () => {
    expect(sayiAlani().parse("12.5")).toBe(12.5);
  });

  it("Türkçe ondalık virgülünü kabul eder", () => {
    expect(sayiAlani().parse("12,5")).toBe(12.5);
  });

  it("sayıya çevrilemeyen metni reddeder", () => {
    expect(() => sayiAlani().parse("abc")).toThrow();
  });

  it("boş metni reddeder (zorunlu alan)", () => {
    expect(() => sayiAlani().parse("")).toThrow();
  });

  it("pipe hedefindeki kısıtı uygular", () => {
    const pozitif = sayiAlani(z.number().positive());
    expect(pozitif.parse("3")).toBe(3);
    expect(() => pozitif.parse("0")).toThrow();
    expect(() => pozitif.parse("-1")).toThrow();
  });

  it("tam sayı kısıtını uygular", () => {
    const tam = sayiAlani(z.number().int());
    expect(tam.parse("2024")).toBe(2024);
    expect(() => tam.parse("2024.5")).toThrow();
  });
});

describe("opsiyonelSayi", () => {
  const sema = opsiyonelSayi(z.number().nonnegative());

  it("boş metni gönderilmemiş sayar", () => {
    expect(sema.parse("")).toBeUndefined();
    expect(sema.parse("   ")).toBeUndefined();
  });

  it("undefined'ı korur", () => {
    expect(sema.parse(undefined)).toBeUndefined();
  });

  it("değer verildiğinde kısıtı uygular", () => {
    expect(sema.parse("5")).toBe(5);
    expect(() => sema.parse("-5")).toThrow();
  });
});

describe("tarihAlani", () => {
  it("ISO metnini Date'e çevirir", () => {
    expect(tarihAlani().parse("2026-03-15")).toEqual(new Date("2026-03-15"));
  });

  it("Date nesnesini olduğu gibi kabul eder", () => {
    const d = new Date("2026-03-15T10:00:00Z");
    expect(tarihAlani().parse(d)).toEqual(d);
  });

  it("ISO saat bileşenini kabul eder", () => {
    expect(tarihAlani().parse("2026-03-15T14:30")).toEqual(
      new Date("2026-03-15T14:30"),
    );
  });

  it("ISO olmayan metni reddeder", () => {
    // new Date() bunları sessizce yanlış tarihe çevirebiliyor
    for (const geçersiz of ["15 Mart", "15.03.2026", "March 15 2026", "abc"]) {
      expect(() => tarihAlani().parse(geçersiz)).toThrow();
    }
  });

  it("ISO biçiminde ama var olmayan günü reddeder", () => {
    expect(() => tarihAlani().parse("2026-02-31")).toThrow();
  });

  it("opsiyonel biçimi boş metni gönderilmemiş sayar", () => {
    expect(opsiyonelTarih().parse("")).toBeUndefined();
  });
});

describe("saatAlani", () => {
  it("HH:mm biçimini kabul eder", () => {
    expect(saatAlani().parse("08:30")).toBe("08:30");
    expect(saatAlani().parse("23:59")).toBe("23:59");
  });

  it("geçersiz saatleri reddeder", () => {
    for (const geçersiz of ["24:00", "8:30", "08:60", "0830", ""]) {
      expect(() => saatAlani().parse(geçersiz)).toThrow();
    }
  });
});

describe("opsiyonelMetin", () => {
  it("boş ve boşluklu metni undefined yapar", () => {
    expect(opsiyonelMetin.parse("")).toBeUndefined();
    expect(opsiyonelMetin.parse("  ")).toBeUndefined();
    expect(opsiyonelMetin.parse(null)).toBeUndefined();
    expect(opsiyonelMetin.parse(undefined)).toBeUndefined();
  });

  it("dolu metni kırpar", () => {
    expect(opsiyonelMetin.parse("  Kars  ")).toBe("Kars");
  });
});

describe("enumAlani", () => {
  const sema = enumAlani(Durum, Durum.AKTIF);

  it("boş metin ve undefined varsayılana düşer", () => {
    expect(sema.parse("")).toBe("AKTIF");
    expect(sema.parse(undefined)).toBe("AKTIF");
  });

  it("geçerli değeri geçirir", () => {
    expect(sema.parse("IZINLI")).toBe("IZINLI");
  });

  it("tanımsız değeri reddeder", () => {
    expect(() => sema.parse("HAYALET")).toThrow();
  });
});

describe("mantiksalAlan", () => {
  it("checkbox ve metin biçimlerini okur", () => {
    for (const doğru of [true, "true", "1", "on", "evet", "TRUE"]) {
      expect(mantiksalAlan.parse(doğru)).toBe(true);
    }
    for (const yanlış of [false, "false", "0", "", undefined, null]) {
      expect(mantiksalAlan.parse(yanlış)).toBe(false);
    }
  });
});

describe("formVerisi", () => {
  it("FormData'yı düz nesneye çevirir", () => {
    const fd = new FormData();
    fd.set("plaka", "36 ABC 123");
    fd.set("modelYili", "2020");
    expect(formVerisi(fd)).toEqual({ plaka: "36 ABC 123", modelYili: "2020" });
  });

  it("dosya alanlarını atlar", () => {
    const fd = new FormData();
    fd.set("ad", "Kars");
    fd.set("foto", new File(["x"], "a.jpg", { type: "image/jpeg" }));
    expect(formVerisi(fd)).toEqual({ ad: "Kars" });
  });
});
