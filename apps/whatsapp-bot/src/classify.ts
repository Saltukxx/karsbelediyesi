import { readFile } from "fs/promises";
import { GoogleGenAI, Type, createPartFromBase64 } from "@google/genai";
import { MAHALLELER, SIKAYET_TURLERI } from "@kars/shared";
import type { Classification } from "./classification-types.js";
import { exampleLabel, exampleUserText, loadFewShotExamples } from "./training-format.js";
import { isPlaceholderIcerik } from "./media.js";
import {
  DEPARTMENT_BY_TUR,
  INTENT_LEXICON,
  MAHALLE_ALIASES,
  ONCELIK_LEXICON,
  TUR_LEXICON,
  type LexGroup,
} from "./issue-lexicon.js";

export type { Classification } from "./classification-types.js";

export type ClassifyMedia = {
  mimeType: string;
  filePath: string;
};

const TUR_NAMES = SIKAYET_TURLERI.map((t) => t.name);
const MAHALLE_SET = new Set<string>(MAHALLELER);
const TUR_SET = new Set<string>(TUR_NAMES);

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      enum: ["sikayet", "bilgi_talebi", "durum_sorgu", "tesekkur", "diger"],
    },
    sikayet_turu: { type: Type.STRING, nullable: true },
    mahalle: { type: Type.STRING, nullable: true },
    adres: { type: Type.STRING, nullable: true },
    aciklama_ozeti: { type: Type.STRING, nullable: true },
    oncelik: {
      type: Type.STRING,
      enum: ["NORMAL", "ACIL", "COK_ACIL"],
    },
    guven: { type: Type.NUMBER },
  },
  required: [
    "intent",
    "sikayet_turu",
    "mahalle",
    "adres",
    "aciklama_ozeti",
    "oncelik",
    "guven",
  ],
};

function resolveModel(): string {
  return (
    process.env.GEMINI_TUNED_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    "gemini-2.5-flash"
  );
}

function issueRoutingHint(): string {
  return `Sorun kelimelerini doğru türe bağla; tür otomatik müdürlüğe gider:
- Su Arızası → Su ve Kanalizasyon (boru, patlak, kaçak, su kesik/yok, basınç, akıntı, fışkırıyor, bulanık/sarı su, sayaç)
- Logar Tıkanıklığı → Su ve Kanalizasyon (logar/rögar/mazgal, kanalizasyon, tıkanık, lağım, pis su, logar taştı)
- Vidanjör Talebi → Su ve Kanalizasyon (vidanjör, fosseptik/foseptik, atık su çekme, kuyu boşalt)
- Yol Bozukluğu → Fen İşleri (çukur, yol/cadde bozuk, kaldırım, bordür, parke, stabilize; asfalt DEĞİLSE)
- Asfalt Onarım → Fen İşleri (asfalt, yama, kaplama, asfalt çökmüş/delik/çatlak)
- Çöp Toplama → Temizlik (çöp, konteyner, çöp arabası/kamyonu, toplanmadı, süpürme)
- Park Bakım → Park ve Bahçeler (park, ağaç/dal düştü, salıncak, çim, park lambası, yeşil alan)
- Zabıta Şikayeti → Zabıta (zabıta, gürültü/müzik, seyyar, köpek, işgal, kaçak yapı, moloz)
- Ulaşım Sorunu → Ulaşım (otobüs/minibüs/dolmuş/ring, durak, güzergah, sefer, kentkart)
- Diğer → Fen İşleri (kar/küreme/buz, sokak lambası, trafik levhası/ışığı, belirsiz)
Öncelik çakışmada: vidanjör > logar > su; asfalt > yol çukuru; çöp arabası > genel kir; zabıta > genel gürültü kelimesi.`;
}

function systemInstruction(): string {
  return `Sen Kars Belediyesi WhatsApp hattı sınıflandırıcısısın.
Amacın: vatandaşın sorununu doğru şikayet türüne bağlamak ki kayıt doğru müdürlüğe düşsün.
Mahalleler (yalnızca bunlardan seç veya null): ${MAHALLELER.join(", ")}
Şikayet türleri (yalnızca bunlardan seç veya null): ${TUR_NAMES.join(", ")}
${issueRoutingHint()}
Gelen vatandaş mesajını JSON şemasına göre sınıflandır.
intent: sikayet | bilgi_talebi | durum_sorgu | tesekkur | diger
oncelik: NORMAL | ACIL | COK_ACIL
guven: 0 ile 1 arası (emin değilsen düşük ver).
Kurallar:
- Yazım hataları/argo: cop→çöp, vidanjor→vidanjör, cukur→çukur, yenisehir→Yenişehir.
- sikayet_turu seçimi kritik: yanlış tür yanlış müdürlüğe gider.
- Mahalle yoksa mahalle=null; türü yine de tahmin et, guven'i düşür.
- Sokak/cadde/no varsa adres alanına yaz.
- "(fotoğraf)" / "(sesli mesaj)" tek başına → intent=sikayet, tür/mahalle null, guven ~0.35.
- Fotoğraf/ses varsa sorunu görsel/sesten çıkar, türe bağla.
- Bilgi soruları → bilgi_talebi; takip/numara/aşama → durum_sorgu.`;
}

function userPromptText(text: string, media?: ClassifyMedia | null): string {
  if (!media) {
    return `Vatandaş mesajı:\n${text}`;
  }
  if (media.mimeType.startsWith("audio/")) {
    return `Vatandaş sesli mesajı (ekli sesi dinle)${text && !isPlaceholderIcerik(text) ? ` ve metin/altyazı:\n${text}` : ":\n(metin yok, yalnızca ses)"}`;
  }
  return `Vatandaş mesajı (fotoğraflı)${text && !isPlaceholderIcerik(text) ? `:\n${text}` : ":\n(metin yok, görsel içerik)"}`;
}

export function asciiFold(s: string): string {
  return s
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/â/g, "a")
    .replace(/î/g, "i")
    .replace(/û/g, "u");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Token-aware match: short terms need word edges; phrases use includes. */
export function textHasTerm(fold: string, term: string): boolean {
  const t = asciiFold(term).trim();
  if (!t) return false;
  if (t.includes(" ") || t.length >= 5) return fold.includes(t);
  const re = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(t)}(?:$|[^a-z0-9])`);
  return re.test(fold);
}

export function scoreLexicon(fold: string, groups: LexGroup[]): number {
  let score = 0;
  for (const g of groups) {
    for (const term of g.terms) {
      if (textHasTerm(fold, term)) {
        score += g.weight;
        break; // one hit per group
      }
    }
  }
  return score;
}

export function scoreSikayetTuru(fold: string): { tur: string | null; score: number } {
  let best: string | null = null;
  let bestScore = 0;
  for (const [tur, groups] of Object.entries(TUR_LEXICON)) {
    const score = scoreLexicon(fold, groups);
    if (score > bestScore) {
      bestScore = score;
      best = tur;
    }
  }
  return { tur: bestScore > 0 ? best : null, score: bestScore };
}

export function selectSikayetTuru(fold: string): string | null {
  return scoreSikayetTuru(fold).tur;
}

/** Issue words → tür + hedef müdürlük (routing). */
export function resolveIssueRouting(text: string): {
  sikayet_turu: string | null;
  department: string | null;
  score: number;
} {
  const { tur, score } = scoreSikayetTuru(asciiFold(text));
  return {
    sikayet_turu: tur,
    department: tur ? (DEPARTMENT_BY_TUR[tur] ?? null) : null,
    score,
  };
}

export function selectMahalle(fold: string): string | null {
  // Longest alias wins (avoids "merkez" stealing longer names; prefers "yenisehir mahallesi")
  let best: string | null = null;
  let bestLen = 0;
  for (const { name, aliases } of MAHALLE_ALIASES) {
    for (const alias of aliases) {
      const a = asciiFold(alias);
      if (a.length < bestLen) continue;
      if (textHasTerm(fold, a) || fold.includes(a)) {
        if (a.length > bestLen) {
          best = name;
          bestLen = a.length;
        }
      }
    }
  }
  if (best) return best;

  for (const m of MAHALLELER) {
    const full = asciiFold(m);
    const short = full.replace(/ mahallesi$/, "");
    if (fold.includes(full) || (short.length >= 4 && textHasTerm(fold, short))) {
      return m;
    }
  }
  return null;
}

function selectIntent(
  fold: string,
): "durum_sorgu" | "tesekkur" | "bilgi_talebi" | null {
  const scores = {
    durum_sorgu: scoreLexicon(fold, INTENT_LEXICON.durum_sorgu),
    tesekkur: scoreLexicon(fold, INTENT_LEXICON.tesekkur),
    bilgi_talebi: scoreLexicon(fold, INTENT_LEXICON.bilgi_talebi),
  };
  let best: "durum_sorgu" | "tesekkur" | "bilgi_talebi" | null = null;
  let bestScore = 0;
  for (const [intent, score] of Object.entries(scores) as Array<
    ["durum_sorgu" | "tesekkur" | "bilgi_talebi", number]
  >) {
    if (score > bestScore) {
      bestScore = score;
      best = intent;
    }
  }
  return bestScore >= 4 ? best : null;
}

function selectOncelik(fold: string): Classification["oncelik"] {
  const cok = scoreLexicon(fold, ONCELIK_LEXICON.COK_ACIL);
  const acil = scoreLexicon(fold, ONCELIK_LEXICON.ACIL);
  if (cok >= 4) return "COK_ACIL";
  if (acil >= 3 || cok > 0) return "ACIL";
  return "NORMAL";
}

function extractAdres(raw: string): string | null {
  const adresMatch =
    raw.match(/(\d+\.\s*(?:cadde|sokak|sk\.?|cad\.?)[^,]*)/i) ||
    raw.match(/((?:cadde|sokak)\s*no[:\s]?\d+)/i) ||
    raw.match(/(no[:\s]?\d+)/i) ||
    raw.match(/((?:cami|okul|pazar|hastane)\s*(?:yanı|yaninda|yanında|karsisi|karşısı)?)/i);
  return adresMatch?.[1]?.trim() ?? null;
}

function fuzzyMatchTur(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t || t === "null") return null;
  if (TUR_SET.has(t)) return t;
  const exact = TUR_NAMES.find((n) => n.toLowerCase() === t.toLowerCase());
  if (exact) return exact;

  const fold = asciiFold(t);
  const fromLex = selectSikayetTuru(fold);
  if (fromLex) return fromLex;

  // substring / partial name
  const partial = TUR_NAMES.find(
    (n) => asciiFold(n).includes(fold) || fold.includes(asciiFold(n).split(" ")[0] ?? ""),
  );
  return partial ?? null;
}

function fuzzyMatchMahalle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t || t === "null") return null;
  if (MAHALLE_SET.has(t as (typeof MAHALLELER)[number])) return t;
  const exact = MAHALLELER.find((m) => m.toLowerCase() === t.toLowerCase());
  if (exact) return exact;
  return selectMahalle(asciiFold(t));
}

export function normalizeClassification(raw: Partial<Classification> | null | undefined): Classification {
  const intent = raw?.intent;
  const validIntent =
    intent === "sikayet" ||
    intent === "bilgi_talebi" ||
    intent === "durum_sorgu" ||
    intent === "tesekkur" ||
    intent === "diger"
      ? intent
      : "diger";

  const sikayet_turu = fuzzyMatchTur(raw?.sikayet_turu);
  const mahalle = fuzzyMatchMahalle(raw?.mahalle);

  const oncelik =
    raw?.oncelik === "ACIL" || raw?.oncelik === "COK_ACIL" || raw?.oncelik === "NORMAL"
      ? raw.oncelik
      : "NORMAL";

  let guven = Number(raw?.guven);
  if (!Number.isFinite(guven)) guven = 0.5;
  guven = Math.min(1, Math.max(0, guven));

  return {
    intent: validIntent,
    sikayet_turu,
    mahalle,
    adres: raw?.adres || null,
    aciklama_ozeti: raw?.aciklama_ozeti || null,
    oncelik,
    guven,
  };
}

export async function classifyMessage(
  text: string,
  media?: ClassifyMedia | null,
): Promise<Classification> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return heuristicClassify(text, Boolean(media));
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = resolveModel();
  const fewShotLimit = Number(process.env.GEMINI_FEW_SHOT ?? "12");
  const fewShot = loadFewShotExamples(
    Number.isFinite(fewShotLimit) && fewShotLimit > 0 ? fewShotLimit : 12,
  );

  type Part = { text: string } | ReturnType<typeof createPartFromBase64>;
  const contents: Array<{ role: string; parts: Part[] }> = [];
  for (const ex of fewShot) {
    contents.push({
      role: "user",
      parts: [{ text: exampleUserText(ex) }],
    });
    const label = exampleLabel(ex);
    contents.push({
      role: "model",
      parts: [{ text: JSON.stringify(label ?? {}) }],
    });
  }

  const userParts: Part[] = [{ text: userPromptText(text, media) }];
  if (media) {
    try {
      const buf = await readFile(media.filePath);
      userParts.push(
        createPartFromBase64(buf.toString("base64"), media.mimeType),
      );
    } catch {
      return heuristicClassify(text, true);
    }
  }
  contents.push({ role: "user", parts: userParts });

  try {
    const res = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: systemInstruction(),
        temperature: 0.2,
        responseMimeType: "application/json",
        responseJsonSchema: RESPONSE_SCHEMA,
      },
    });

    const rawText = res.text;
    if (!rawText) return heuristicClassify(text, Boolean(media));
    const parsed = JSON.parse(rawText) as Partial<Classification>;
    return refineWithLexicon(text, normalizeClassification(parsed), Boolean(media));
  } catch {
    try {
      const fallbackParts: Part[] = [
        {
          text: `${systemInstruction()}\n\nMesaj: ${text}\n\nSadece geçerli JSON döndür.`,
        },
      ];
      if (media) {
        try {
          const buf = await readFile(media.filePath);
          fallbackParts.push(
            createPartFromBase64(buf.toString("base64"), media.mimeType),
          );
        } catch {
          /* text-only fallback */
        }
      }
      const res = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: fallbackParts }],
        config: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      });
      const rawText = res.text;
      if (!rawText) return heuristicClassify(text, Boolean(media));
      const match = rawText.match(/\{[\s\S]*\}/);
      if (!match) return heuristicClassify(text, Boolean(media));
      return refineWithLexicon(
        text,
        normalizeClassification(JSON.parse(match[0]) as Partial<Classification>),
        Boolean(media),
      );
    } catch {
      return heuristicClassify(text, Boolean(media));
    }
  }
}

/**
 * Align AI output with local issue-word routing so the complaint
 * lands in the correct department (via sikayet_turu → defaultDepartment).
 */
export function refineWithLexicon(
  text: string,
  ai: Classification,
  hasMedia = false,
): Classification {
  const fold = asciiFold(text);
  const { tur: lexTur, score: lexScore } = scoreSikayetTuru(fold);
  const lexMahalle = selectMahalle(fold);
  const lexAdres = extractAdres(text);
  const lexOncelik = selectOncelik(fold);

  let { sikayet_turu, mahalle, adres, oncelik, guven } = ai;

  if (lexTur && lexScore > 0) {
    if (!sikayet_turu) {
      sikayet_turu = lexTur;
      guven = Math.max(guven, Math.min(0.78, 0.45 + lexScore * 0.04));
    } else if (sikayet_turu === "Diğer" && lexTur !== "Diğer" && lexScore >= 4) {
      sikayet_turu = lexTur;
    } else if (sikayet_turu !== lexTur) {
      const aiScore = scoreLexicon(fold, TUR_LEXICON[sikayet_turu] ?? []);
      // Lexicon clearly identifies a different issue → prefer it for department routing
      if (lexScore >= 5 && lexScore >= aiScore + 3) {
        sikayet_turu = lexTur;
        guven = Math.min(guven, 0.8);
      }
    }
  }

  if (!mahalle && lexMahalle) {
    mahalle = lexMahalle;
  }
  if (!adres && lexAdres) {
    adres = lexAdres;
  }
  if (oncelik === "NORMAL" && lexOncelik !== "NORMAL") {
    oncelik = lexOncelik;
  }

  if (hasMedia && isPlaceholderIcerik(text) && !sikayet_turu && !mahalle) {
    guven = Math.min(guven, 0.4);
  }

  return { ...ai, sikayet_turu, mahalle, adres, oncelik, guven };
}

export function heuristicClassify(text: string, hasMedia = false): Classification {
  const raw = text.trim();
  const fold = asciiFold(raw);
  const mediaOnly =
    (hasMedia && (!raw || isPlaceholderIcerik(raw))) || isPlaceholderIcerik(raw);

  if (mediaOnly) {
    return {
      intent: "sikayet",
      sikayet_turu: null,
      mahalle: null,
      adres: null,
      aciklama_ozeti: raw.slice(0, 200) || "Medya eki (metin yok)",
      oncelik: "NORMAL",
      guven: 0.35,
    };
  }

  const intentHit = selectIntent(fold);
  if (intentHit === "durum_sorgu") {
    return {
      intent: "durum_sorgu",
      sikayet_turu: null,
      mahalle: null,
      adres: null,
      aciklama_ozeti: raw.slice(0, 200),
      oncelik: "NORMAL",
      guven: 0.6,
    };
  }
  if (intentHit === "tesekkur") {
    return {
      intent: "tesekkur",
      sikayet_turu: null,
      mahalle: null,
      adres: null,
      aciklama_ozeti: raw.slice(0, 200),
      oncelik: "NORMAL",
      guven: 0.75,
    };
  }
  if (intentHit === "bilgi_talebi") {
    return {
      intent: "bilgi_talebi",
      sikayet_turu: selectSikayetTuru(fold),
      mahalle: selectMahalle(fold),
      adres: null,
      aciklama_ozeti: raw.slice(0, 200),
      oncelik: "NORMAL",
      guven: 0.65,
    };
  }

  const sikayet_turu = selectSikayetTuru(fold);
  const mahalle = selectMahalle(fold);
  const adres = extractAdres(raw);
  const oncelik = selectOncelik(fold);

  const looksLikeComplaint =
    Boolean(sikayet_turu) || textHasTerm(fold, "sikayet") || textHasTerm(fold, "yardim");
  if (!looksLikeComplaint && raw.length < 12) {
    return {
      intent: "diger",
      sikayet_turu: null,
      mahalle: null,
      adres: null,
      aciklama_ozeti: raw.slice(0, 200),
      oncelik: "NORMAL",
      guven: 0.5,
    };
  }

  return {
    intent: "sikayet",
    sikayet_turu,
    mahalle,
    adres,
    aciklama_ozeti: raw.slice(0, 300),
    oncelik,
    guven: sikayet_turu && mahalle ? 0.82 : sikayet_turu || mahalle ? 0.62 : 0.4,
  };
}
