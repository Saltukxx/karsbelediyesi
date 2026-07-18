import { prisma } from "@kars/db";
import type { Classification } from "./classification-types.js";
import {
  asciiFold,
  scoreSikayetTuru,
  selectMahalle,
} from "./classify.js";
import { isPlaceholderIcerik } from "./media.js";

export type WhatsAppAwaiting = "ACIKLAMA" | "MAHALLE" | "ADRES";

export const SESSION_TTL_MS = 45 * 60 * 1000;

export type SessionDraft = {
  classification: Classification;
  askedAdres: boolean;
  sourceMessageIds?: string[];
};

export type ActiveSession = {
  id: string;
  telefon: string;
  awaiting: WhatsAppAwaiting | null;
  draft: SessionDraft;
  expiresAt: Date;
};

const ADRES_SKIP = new Set([
  "yok",
  "yok adres",
  "adres yok",
  "bilmiyorum",
  "bilmiyorum adres",
  "geç",
  "gec",
  "gecmek",
  "atla",
  "yoktur",
  "emin degilim",
  "emin değilim",
  "-",
  ".",
]);

export function emptyDraft(seed?: Partial<Classification>): SessionDraft {
  return {
    classification: {
      intent: seed?.intent ?? "sikayet",
      sikayet_turu: seed?.sikayet_turu ?? null,
      mahalle: seed?.mahalle ?? null,
      adres: seed?.adres ?? null,
      aciklama_ozeti: seed?.aciklama_ozeti ?? null,
      oncelik: seed?.oncelik ?? "NORMAL",
      guven: seed?.guven ?? 0.5,
    },
    askedAdres: false,
    sourceMessageIds: [],
  };
}

export function parseDraft(raw: unknown): SessionDraft {
  const obj = (raw ?? {}) as Partial<SessionDraft>;
  const c = (obj.classification ?? {}) as Partial<Classification>;
  return {
    classification: {
      intent: c.intent ?? "sikayet",
      sikayet_turu: c.sikayet_turu ?? null,
      mahalle: c.mahalle ?? null,
      adres: c.adres ?? null,
      aciklama_ozeti: c.aciklama_ozeti ?? null,
      oncelik: c.oncelik ?? "NORMAL",
      guven: typeof c.guven === "number" ? c.guven : 0.5,
    },
    askedAdres: Boolean(obj.askedAdres),
    sourceMessageIds: Array.isArray(obj.sourceMessageIds)
      ? obj.sourceMessageIds.filter((x): x is string => typeof x === "string")
      : [],
  };
}

export function hasUsableIssue(c: Classification): boolean {
  if (c.sikayet_turu && c.sikayet_turu !== "Diğer") return true;
  const oz = (c.aciklama_ozeti ?? "").trim();
  if (!oz || isPlaceholderIcerik(oz)) return false;
  if (oz.length < 8) return false;
  if (/^(medya|fotoğraf|sesli|sikayet|şikayet)/i.test(oz) && oz.length < 20) {
    return false;
  }
  return true;
}

export function isAdresSkip(text: string): boolean {
  const t = asciiFold(text).trim().replace(/\s+/g, " ");
  if (ADRES_SKIP.has(t)) return true;
  if (/^(yok|bilmiyorum|gec|geç|atla)\b/.test(t) && t.length <= 24) return true;
  return false;
}

/** Prefer newer non-null fields; keep stronger tür/mahalle when both present. */
export function mergeDraft(
  prev: Classification,
  next: Classification,
  rawText = "",
): Classification {
  const fold = asciiFold(rawText);
  const lexTur = scoreSikayetTuru(fold);
  const lexMahalle = selectMahalle(fold);

  let sikayet_turu = next.sikayet_turu ?? prev.sikayet_turu;
  if (next.sikayet_turu && prev.sikayet_turu && next.sikayet_turu !== prev.sikayet_turu) {
    const nextScore = scoreSikayetTuru(asciiFold(next.sikayet_turu ?? "")).score;
    const prevScore = scoreSikayetTuru(asciiFold(prev.sikayet_turu ?? "")).score;
    // If lexicon on raw text strongly prefers one, use that
    if (lexTur.tur && lexTur.score >= 5) {
      sikayet_turu = lexTur.tur;
    } else if (prevScore > nextScore + 2 && !next.sikayet_turu) {
      sikayet_turu = prev.sikayet_turu;
    } else if (next.sikayet_turu) {
      sikayet_turu = next.sikayet_turu;
    }
  }
  if (!sikayet_turu && lexTur.tur) sikayet_turu = lexTur.tur;

  let mahalle = next.mahalle ?? prev.mahalle;
  if (!mahalle && lexMahalle) mahalle = lexMahalle;
  if (next.mahalle && prev.mahalle && next.mahalle !== prev.mahalle) {
    // Short mahalle-only replies should win
    if (rawText.trim().length <= 40 && (lexMahalle || next.mahalle)) {
      mahalle = next.mahalle ?? lexMahalle;
    }
  }

  let adres = next.adres ?? prev.adres;
  if (!adres && rawText.trim().length >= 5 && /cadde|sokak|sk\.|no[:\s]?\d/i.test(rawText)) {
    adres = rawText.trim().slice(0, 120);
  }

  const aciklama_ozeti =
    next.aciklama_ozeti &&
    !isPlaceholderIcerik(next.aciklama_ozeti) &&
    next.aciklama_ozeti.length >= (prev.aciklama_ozeti?.length ?? 0)
      ? next.aciklama_ozeti
      : prev.aciklama_ozeti && !isPlaceholderIcerik(prev.aciklama_ozeti)
        ? prev.aciklama_ozeti
        : next.aciklama_ozeti ?? prev.aciklama_ozeti;

  const oncelik =
    next.oncelik === "COK_ACIL" || prev.oncelik === "COK_ACIL"
      ? "COK_ACIL"
      : next.oncelik === "ACIL" || prev.oncelik === "ACIL"
        ? "ACIL"
        : "NORMAL";

  const guven = Math.max(next.guven ?? 0, prev.guven ?? 0);
  // Filling slots gradually should not keep artificially high guven from first turn alone
  const filledBonus =
    (sikayet_turu ? 0.05 : 0) + (mahalle ? 0.1 : 0) + (adres ? 0.05 : 0);

  return {
    intent: "sikayet",
    sikayet_turu,
    mahalle,
    adres,
    aciklama_ozeti,
    oncelik,
    guven: Math.min(1, Math.max(guven, 0.45 + filledBonus)),
  };
}

export function nextAwaiting(draft: SessionDraft): WhatsAppAwaiting | null {
  const c = draft.classification;
  if (!hasUsableIssue(c)) return "ACIKLAMA";
  if (!c.mahalle) return "MAHALLE";
  if (!draft.askedAdres && !c.adres) return "ADRES";
  return null;
}

export function replyForAwaiting(awaiting: WhatsAppAwaiting): string {
  switch (awaiting) {
    case "ACIKLAMA":
      return "Anladım, kayıt için sorunu kısaca yazar mısınız? (örn. yol çukuru, çöp toplanmadı, su kaçağı) Fotoğraf da gönderebilirsiniz.";
    case "MAHALLE":
      return "Şikayetinizi almak için mahalle bilgisini yazar mısınız? (örn. Yenişehir, Ortakapı)";
    case "ADRES":
      return "Teşekkürler. Mümkünse sokak/cadde ve kapı no yazar mısınız? (örn. Cumhuriyet Cad. No:12) Bilmiyorsanız 'yok' yazabilirsiniz.";
    default: {
      const _exhaustive: never = awaiting;
      return _exhaustive;
    }
  }
}

export async function getSession(telefon: string): Promise<ActiveSession | null> {
  const row = await prisma.whatsAppSession.findUnique({ where: { telefon } });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.whatsAppSession.delete({ where: { id: row.id } }).catch(() => undefined);
    return null;
  }
  return {
    id: row.id,
    telefon: row.telefon,
    awaiting: row.awaiting,
    draft: parseDraft(row.draft),
    expiresAt: row.expiresAt,
  };
}

export async function upsertSession(
  telefon: string,
  draft: SessionDraft,
  awaiting: WhatsAppAwaiting | null,
): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.whatsAppSession.upsert({
    where: { telefon },
    create: {
      telefon,
      draft: draft as object,
      awaiting: awaiting ?? undefined,
      expiresAt,
    },
    update: {
      draft: draft as object,
      awaiting: awaiting ?? null,
      expiresAt,
    },
  });
}

export async function clearSession(telefon: string): Promise<void> {
  await prisma.whatsAppSession.deleteMany({ where: { telefon } });
}

/** True when citizen is likely filling the open slot rather than starting a brand-new complaint. */
export function looksLikeSlotFill(
  text: string,
  awaiting: WhatsAppAwaiting | null,
  classified: Classification,
): boolean {
  const t = text.trim();
  if (!awaiting) return false;
  if (awaiting === "ADRES" && (isAdresSkip(t) || t.length <= 80)) return true;
  if (awaiting === "MAHALLE") {
    if (t.length <= 40) return true;
    if (classified.mahalle && !classified.sikayet_turu) return true;
  }
  if (awaiting === "ACIKLAMA") {
    if (classified.intent === "sikayet" || t.length <= 120) return true;
  }
  // short replies during any active session
  if (t.length <= 30 && classified.intent !== "durum_sorgu" && classified.intent !== "tesekkur") {
    return true;
  }
  return false;
}
