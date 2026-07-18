import { describe, it, expect } from "vitest";
import type { Classification } from "./classification-types";
import {
  emptyDraft,
  hasUsableIssue,
  isAdresSkip,
  mergeDraft,
  nextAwaiting,
  replyForAwaiting,
} from "./session";

function base(partial: Partial<Classification> = {}): Classification {
  return {
    intent: "sikayet",
    sikayet_turu: null,
    mahalle: null,
    adres: null,
    aciklama_ozeti: null,
    oncelik: "NORMAL",
    guven: 0.5,
    ...partial,
  };
}

describe("mergeDraft", () => {
  it("vatandaş sadece mahalle yazınca türü korur", () => {
    const prev = base({
      sikayet_turu: "Su Arızası",
      aciklama_ozeti: "Su borusu patladı",
      guven: 0.8,
    });
    const next = base({
      mahalle: "Yenişehir Mahallesi",
      intent: "diger",
      guven: 0.4,
    });
    const merged = mergeDraft(prev, next, "Yenişehir");
    expect(merged.sikayet_turu).toBe("Su Arızası");
    expect(merged.mahalle).toBe("Yenişehir Mahallesi");
    expect(merged.aciklama_ozeti).toBe("Su borusu patladı");
  });
});

describe("nextAwaiting", () => {
  it("issue → mahalle → adres sırasını izler", () => {
    expect(nextAwaiting(emptyDraft())).toBe("ACIKLAMA");

    const withIssue = emptyDraft({
      sikayet_turu: "Çöp Toplama",
      aciklama_ozeti: "Çöp toplanmamış",
    });
    expect(nextAwaiting(withIssue)).toBe("MAHALLE");

    const withMahalle = {
      ...withIssue,
      classification: {
        ...withIssue.classification,
        mahalle: "Atatürk Mahallesi",
      },
    };
    expect(nextAwaiting(withMahalle)).toBe("ADRES");

    const asked = { ...withMahalle, askedAdres: true };
    expect(nextAwaiting(asked)).toBeNull();

    const withAdres = {
      ...withMahalle,
      askedAdres: false,
      classification: {
        ...withMahalle.classification,
        adres: "7. Cadde No:14",
      },
    };
    expect(nextAwaiting(withAdres)).toBeNull();
  });
});

describe("adres skip", () => {
  it("yok / bilmiyorum / geç ifadelerini tanır", () => {
    expect(isAdresSkip("yok")).toBe(true);
    expect(isAdresSkip("bilmiyorum")).toBe(true);
    expect(isAdresSkip("geç")).toBe(true);
    expect(isAdresSkip("gec")).toBe(true);
    expect(isAdresSkip("7. cadde no 12")).toBe(false);
  });
});

describe("hasUsableIssue", () => {
  it("placeholder ve çok kısa özeti reddeder", () => {
    expect(hasUsableIssue(base({ aciklama_ozeti: "(fotoğraf)" }))).toBe(false);
    expect(hasUsableIssue(base({ sikayet_turu: "Su Arızası" }))).toBe(true);
    expect(
      hasUsableIssue(base({ aciklama_ozeti: "Yolda büyük çukur var" })),
    ).toBe(true);
  });
});

describe("replyForAwaiting", () => {
  it("Türkçe şablon döner", () => {
    expect(replyForAwaiting("MAHALLE")).toMatch(/mahalle/i);
    expect(replyForAwaiting("ADRES")).toMatch(/sokak|cadde|yok/i);
    expect(replyForAwaiting("ACIKLAMA")).toMatch(/sorunu/i);
  });
});
