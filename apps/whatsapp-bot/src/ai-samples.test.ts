/**
 * Gemini / heuristic sınıflandırma örnekleri.
 * GEMINI_API_KEY yoksa heuristic ile çalışır.
 */
import { describe, it, expect } from "vitest";
import {
  classifyMessage,
  heuristicClassify,
  normalizeClassification,
  selectSikayetTuru,
  selectMahalle,
  asciiFold,
  resolveIssueRouting,
  refineWithLexicon,
} from "./classify";
import {
  GOLD_PATH,
  readJsonl,
  exampleUserText,
  exampleLabel,
  loadFewShotExamples,
} from "./training-format";

const SAMPLES: Array<{ text: string; expectIntent?: string; expectTur?: string }> = [
  { text: "Yenişehir'de su borusu patladı acil", expectIntent: "sikayet", expectTur: "Su Arızası" },
  { text: "durum ne oldu şikayetim", expectIntent: "durum_sorgu" },
  { text: "çok teşekkürler", expectIntent: "tesekkur" },
  { text: "Atatürk mahallesinde çöp toplanmamış", expectIntent: "sikayet", expectTur: "Çöp Toplama" },
  { text: "yolda büyük çukur var Cumhuriyet", expectIntent: "sikayet", expectTur: "Yol Bozukluğu" },
  { text: "yenisehirde su aktıı yardım edin", expectIntent: "sikayet", expectTur: "Su Arızası" },
  { text: "ataturk mah cop toplanmiyo gunlerdir", expectIntent: "sikayet", expectTur: "Çöp Toplama" },
];

describe("WhatsApp AI örnekleri", () => {
  for (const sample of SAMPLES) {
    it(sample.text.slice(0, 40), async () => {
      const r = await classifyMessage(sample.text);
      if (sample.expectIntent) expect(r.intent).toBe(sample.expectIntent);
      if (sample.expectTur) expect(r.sikayet_turu).toBe(sample.expectTur);
      expect(r.guven).toBeGreaterThanOrEqual(0);
      expect(r.guven).toBeLessThanOrEqual(1);
    });
  }
});

describe("normalizeClassification", () => {
  it("whitelist dışı türü null yapar", () => {
    const r = normalizeClassification({
      intent: "sikayet",
      sikayet_turu: "Olmayan Tür",
      mahalle: "Olmayan",
      adres: null,
      aciklama_ozeti: "x",
      oncelik: "NORMAL",
      guven: 1.5,
    });
    expect(r.sikayet_turu).toBeNull();
    expect(r.mahalle).toBeNull();
    expect(r.guven).toBe(1);
  });
});

describe("gold.jsonl", () => {
  it("parse edilebilir ve yeterli satır içerir", () => {
    const rows = readJsonl(GOLD_PATH);
    expect(rows.length).toBeGreaterThanOrEqual(100);
    for (const ex of rows.slice(0, 5)) {
      expect(exampleUserText(ex).length).toBeGreaterThan(0);
      expect(exampleLabel(ex)).not.toBeNull();
    }
  });
});

describe("loadFewShotExamples", () => {
  it("çeşitli intent/tür örnekleri seçer", () => {
    const few = loadFewShotExamples(12);
    expect(few.length).toBe(12);
    const intents = new Set(
      few.map((ex) => exampleLabel(ex)?.intent).filter(Boolean),
    );
    expect(intents.size).toBeGreaterThanOrEqual(3);
  });
});

describe("heuristicClassify slang", () => {
  it("ascii yazımı mahalle ve tür olarak çözer", () => {
    const r = heuristicClassify("yenisehirde su aktıı yardım edin");
    expect(r.intent).toBe("sikayet");
    expect(r.sikayet_turu).toBe("Su Arızası");
    expect(r.mahalle).toBe("Yenişehir Mahallesi");
  });
});

describe("word selection lexicon", () => {
  it("asfalt yol çakışmasında asfaltı seçer", () => {
    expect(selectSikayetTuru(asciiFold("yolda asfalt yamalık"))).toBe("Asfalt Onarım");
  });
  it("vidanjörü logardan ayırır", () => {
    expect(selectSikayetTuru(asciiFold("halitpasa vidanjor lazim"))).toBe(
      "Vidanjör Talebi",
    );
  });
  it("en uzun mahalle aliasını seçer", () => {
    expect(selectMahalle(asciiFold("fevzi cakmak asfalt delik"))).toBe(
      "Fevzi Çakmak Mahallesi",
    );
  });
  it("fuzzy tür normalize eder", () => {
    const r = normalizeClassification({
      intent: "sikayet",
      sikayet_turu: "su arizasi",
      mahalle: "yenisehir",
      adres: null,
      aciklama_ozeti: "x",
      oncelik: "ACIL",
      guven: 0.9,
    });
    expect(r.sikayet_turu).toBe("Su Arızası");
    expect(r.mahalle).toBe("Yenişehir Mahallesi");
  });
});

describe("issue → department routing", () => {
  const cases: Array<{ text: string; tur: string; deptIncludes: string }> = [
    {
      text: "Yenişehir su borusu patladı",
      tur: "Su Arızası",
      deptIncludes: "Su ve Kanalizasyon",
    },
    {
      text: "logar taştı Karadağ çok kötü koku",
      tur: "Logar Tıkanıklığı",
      deptIncludes: "Su ve Kanalizasyon",
    },
    {
      text: "fosseptik dolu vidanjor lazım",
      tur: "Vidanjör Talebi",
      deptIncludes: "Su ve Kanalizasyon",
    },
    {
      text: "yolda büyük çukur var araç düşüyor",
      tur: "Yol Bozukluğu",
      deptIncludes: "Fen İşleri",
    },
    {
      text: "asfalt tamamen bozulmuş yama lazım",
      tur: "Asfalt Onarım",
      deptIncludes: "Fen İşleri",
    },
    {
      text: "çöp arabası 3 gündür gelmedi konteyner dolu",
      tur: "Çöp Toplama",
      deptIncludes: "Temizlik",
    },
    {
      text: "parkta salıncak kırık ağaç düşmüş",
      tur: "Park Bakım",
      deptIncludes: "Park ve Bahçeler",
    },
    {
      text: "gece gürültü zabıta gelsin seyyar",
      tur: "Zabıta Şikayeti",
      deptIncludes: "Zabıta",
    },
    {
      text: "otobüs gelmiyor durak bozuk",
      tur: "Ulaşım Sorunu",
      deptIncludes: "Ulaşım",
    },
  ];

  for (const c of cases) {
    it(`${c.tur} → ${c.deptIncludes}`, () => {
      const r = resolveIssueRouting(c.text);
      expect(r.sikayet_turu).toBe(c.tur);
      expect(r.department).toContain(c.deptIncludes);
      expect(r.score).toBeGreaterThanOrEqual(4);
    });
  }

  it("yanlış AI türünü güçlü issue kelimesiyle düzeltir", () => {
    const fixed = refineWithLexicon(
      "vidanjor acil fosseptik taştı Halitpaşa",
      {
        intent: "sikayet",
        sikayet_turu: "Yol Bozukluğu",
        mahalle: null,
        adres: null,
        aciklama_ozeti: "x",
        oncelik: "NORMAL",
        guven: 0.7,
      },
    );
    expect(fixed.sikayet_turu).toBe("Vidanjör Talebi");
  });

  it("genişletilmiş argo/yazım örneklerini yakalar", () => {
    expect(resolveIssueRouting("sular kesik ust kata cikmiyor").sikayet_turu).toBe(
      "Su Arızası",
    );
    expect(resolveIssueRouting("rogar tasti lagim kokusu").sikayet_turu).toBe(
      "Logar Tıkanıklığı",
    );
    expect(resolveIssueRouting("cop kamyonu gunlerdir gelmedi").sikayet_turu).toBe(
      "Çöp Toplama",
    );
    expect(resolveIssueRouting("agac yola dustu dal kirildi").sikayet_turu).toBe(
      "Park Bakım",
    );
    expect(resolveIssueRouting("sokak lambasi yanmiyor karanlik").sikayet_turu).toBe(
      "Diğer",
    );
    expect(resolveIssueRouting("kar kureme yapilmadi yol buzlu").sikayet_turu).toBe(
      "Diğer",
    );
    expect(resolveIssueRouting("dolmus gelmiyor sefer iptal").department).toContain(
      "Ulaşım",
    );
  });
});
