import { describe, expect, it } from "vitest";
import {
  dispatchAyarSchema,
  kullaniciGuncelleSchema,
  kullaniciOlusturSchema,
  mudurlukInputSchema,
  sifreSchema,
  sikayetTuruInputSchema,
} from "./definitions-schema";

/**
 * Şemalar iki kaynaktan girdi alır: web formunun `FormData`'sı (her şey string,
 * işaretlenmemiş checkbox hiç gelmez) ve mobilin JSON gövdesi. Testler iki
 * biçimin de aynı sonucu ürettiğini doğrular.
 */

describe("sifreSchema", () => {
  it("8 karakterden kısa şifreyi reddeder", () => {
    expect(() => sifreSchema.parse("Ab1234")).toThrow("Şifre en az 8 karakter olmalı");
  });

  it("harf içermeyen şifreyi reddeder", () => {
    expect(() => sifreSchema.parse("12345678")).toThrow("Şifre en az bir harf içermeli");
  });

  it("rakam içermeyen şifreyi reddeder", () => {
    expect(() => sifreSchema.parse("abcdefgh")).toThrow("Şifre en az bir rakam içermeli");
  });

  it("Türkçe harfleri harf sayar", () => {
    expect(sifreSchema.parse("şifreçğ1")).toBe("şifreçğ1");
  });
});

describe("mudurlukInputSchema", () => {
  it("kısa ad boşsa undefined döner (çağıran adın ilk 20 karakterini kullanır)", () => {
    const r = mudurlukInputSchema.parse({ name: "Su ve Kanalizasyon", shortName: "" });
    expect(r.shortName).toBeUndefined();
  });

  it("checkbox gelmezse aktif false olur", () => {
    expect(mudurlukInputSchema.parse({ name: "Park" }).aktif).toBe(false);
  });

  it("checkbox 'on' ise aktif true olur", () => {
    expect(mudurlukInputSchema.parse({ name: "Park", aktif: "on" }).aktif).toBe(true);
  });

  it("JSON boolean'ı da kabul eder", () => {
    expect(mudurlukInputSchema.parse({ name: "Park", aktif: true }).aktif).toBe(true);
  });

  it("boş adı reddeder", () => {
    expect(() => mudurlukInputSchema.parse({ name: "   " })).toThrow();
  });
});

describe("sikayetTuruInputSchema", () => {
  it("boş müdürlük seçimini undefined'a çevirir", () => {
    const r = sikayetTuruInputSchema.parse({ name: "Su kesintisi", defaultDepartmentId: "" });
    expect(r.defaultDepartmentId).toBeUndefined();
  });

  it("adın başındaki/sonundaki boşluğu kırpar", () => {
    expect(sikayetTuruInputSchema.parse({ name: "  Çöp  " }).name).toBe("Çöp");
  });
});

describe("kullaniciOlusturSchema", () => {
  const gecerli = {
    name: "Ayşe Yılmaz",
    phone: "05551234567",
    password: "Parola12",
    role: "CALL_CENTER",
  };

  it("geçerli girdiyi kabul eder", () => {
    expect(kullaniciOlusturSchema.parse(gecerli).role).toBe("CALL_CENTER");
  });

  it("10 haneden kısa telefonu reddeder", () => {
    expect(() => kullaniciOlusturSchema.parse({ ...gecerli, phone: "0555" })).toThrow();
  });

  it("bilinmeyen rolü reddeder", () => {
    expect(() => kullaniciOlusturSchema.parse({ ...gecerli, role: "PATRON" })).toThrow();
  });

  it("müdürlük yöneticisi için müdürlük zorunludur", () => {
    expect(() =>
      kullaniciOlusturSchema.parse({ ...gecerli, role: "DEPARTMENT_MANAGER" }),
    ).toThrow("DEPARTMENT_MANAGER için müdürlük zorunlu");
  });

  it("müdürlük verilince müdürlük yöneticisi geçer", () => {
    const r = kullaniciOlusturSchema.parse({
      ...gecerli,
      role: "DEPARTMENT_MANAGER",
      departmentId: "dep1",
    });
    expect(r.departmentId).toBe("dep1");
  });

  it("oluşturmada şifre zorunludur", () => {
    const sifresiz: Record<string, unknown> = { ...gecerli };
    delete sifresiz.password;
    expect(() => kullaniciOlusturSchema.parse(sifresiz)).toThrow();
  });
});

describe("kullaniciGuncelleSchema", () => {
  const temel = { name: "Ali", phone: "05551234567", role: "DRIVER" };

  it("şifre alanı boşsa değişiklik istenmemiş sayılır", () => {
    expect(kullaniciGuncelleSchema.parse({ ...temel, password: "" }).password).toBe("");
  });

  it("şifre alanı hiç gönderilmese de geçer", () => {
    expect(kullaniciGuncelleSchema.parse(temel).password).toBeUndefined();
  });

  it("gönderilen şifre politikaya uymak zorundadır", () => {
    expect(() => kullaniciGuncelleSchema.parse({ ...temel, password: "kisa" })).toThrow();
  });

  it("aktif checkbox'ı gelmezse kullanıcı pasife çekilir", () => {
    expect(kullaniciGuncelleSchema.parse(temel).aktif).toBe(false);
  });
});

describe("dispatchAyarSchema", () => {
  it("checkbox işaretliyse açık", () => {
    expect(dispatchAyarSchema.parse({ otomatikAtama: "on" }).otomatikAtama).toBe(true);
  });

  it("checkbox gelmezse kapalı", () => {
    expect(dispatchAyarSchema.parse({}).otomatikAtama).toBe(false);
  });

  it("JSON false'u kapalı okur", () => {
    expect(dispatchAyarSchema.parse({ otomatikAtama: false }).otomatikAtama).toBe(false);
  });
});
