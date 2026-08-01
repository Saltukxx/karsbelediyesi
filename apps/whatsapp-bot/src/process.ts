import { nextComplaintSerial, prisma, withSerialRetry } from "@kars/db";
import { geocodeKarsAdres } from "@kars/shared";
import { classifyMessage, type Classification } from "./classify.js";
import type { MediaErrorCode } from "./media.js";
import {
  clearSession,
  emptyDraft,
  getSession,
  isAdresSkip,
  looksLikeSlotFill,
  mergeDraft,
  nextAwaiting,
  replyForAwaiting,
  upsertSession,
  type SessionDraft,
} from "./session.js";

const THRESHOLD_VARSAYILAN = 0.75;

/** Geçersiz env değeri eşiği NaN yapıp her şikayeti otomatik açardı */
function esikOku(): number {
  const ham = process.env.WHATSAPP_AUTO_CONFIDENCE_THRESHOLD;
  if (ham == null || ham.trim() === "") return THRESHOLD_VARSAYILAN;
  const n = Number(ham);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    console.error(
      `WHATSAPP_AUTO_CONFIDENCE_THRESHOLD geçersiz ("${ham}") — ${THRESHOLD_VARSAYILAN} kullanılıyor`,
    );
    return THRESHOLD_VARSAYILAN;
  }
  return n;
}

const THRESHOLD = esikOku();

export type InboundJob = {
  telefon: string;
  icerik: string;
  waMessageId?: string;
  medyaUrl?: string;
  medyaTipi?: string;
  mimeType?: string;
  mediaError?: MediaErrorCode;
};

export type ProcessResult = {
  reply: string;
  complaintId?: string;
  classification: Classification;
  skipped?: boolean;
  /** Yanıtın gönderildiğini işaretlemek için WhatsAppMessage.id */
  messageId?: string;
};

function mediaErrorReply(code?: MediaErrorCode): string {
  if (code === "too_large") {
    return "Gönderdiğiniz dosya çok büyük (en fazla 8 MB). Lütfen daha küçük bir fotoğraf/ses gönderin veya şikayetinizi yazın.";
  }
  if (code === "unsupported") {
    return "Bu dosya türünü işleyemiyoruz. Lütfen fotoğraf veya sesli mesaj gönderin ya da şikayetinizi yazarak iletin.";
  }
  return "Medya alınamadı. Lütfen fotoğraf veya sesli mesajı tekrar gönderin ya da şikayetinizi yazın.";
}

/**
 * Üretilen yanıtı mesaj satırına yazar: gönderim başarısız olup job yeniden
 * denenirse yanıt sıfırdan üretilmeden aynısı gönderilir.
 */
async function yanit(messageId: string, res: ProcessResult): Promise<ProcessResult> {
  await prisma.whatsAppMessage.update({
    where: { id: messageId },
    data: { botYaniti: res.reply },
  });
  return { ...res, messageId };
}

const KARSILAMA =
  "Kars Belediyesi WhatsApp hattına hoş geldiniz. Şikayet veya talebinizi mahalle ve adres bilgisiyle yazabilirsiniz; fotoğraf veya sesli mesaj da gönderebilirsiniz. Açık şikayet durumu için 'durum' yazın.";

/** Şikayet olmayan / bağlam dışı mesajlar için bilgilendirme */
async function karsilamaYaniti(
  job: InboundJob,
  turn: Classification,
): Promise<ProcessResult> {
  const msg = await prisma.whatsAppMessage.create({
    data: {
      telefon: job.telefon,
      yon: "GELEN",
      icerik: job.icerik,
      medyaUrl: job.medyaUrl,
      medyaTipi: job.medyaTipi,
      waMessageId: job.waMessageId,
      aiSonuc: turn,
      guven: turn.guven,
      botYaniti: KARSILAMA,
    },
  });
  return { reply: KARSILAMA, classification: turn, messageId: msg.id };
}

function isFullNewComplaint(c: Classification): boolean {
  return (
    c.intent === "sikayet" &&
    Boolean(c.sikayet_turu) &&
    Boolean(c.mahalle) &&
    (c.guven >= 0.7 || Boolean(c.adres))
  );
}

export async function processInbound(job: InboundJob): Promise<ProcessResult> {
  if (job.waMessageId) {
    const existing = await prisma.whatsAppMessage.findUnique({
      where: { waMessageId: job.waMessageId },
      include: { complaint: true },
    });
    if (existing) {
      const classification = (existing.aiSonuc ?? {
        intent: "diger",
        guven: existing.guven ?? 0,
      }) as Classification;
      // Mesaj işlendi ama yanıt gönderilemeden düştüyse aynı yanıt tekrarlanır
      if (!existing.yanitGonderildi && existing.botYaniti) {
        return {
          reply: existing.botYaniti,
          complaintId: existing.complaintId ?? undefined,
          classification,
          messageId: existing.id,
        };
      }
      if (existing.complaint) {
        return {
          reply: `Şikayetiniz ${existing.complaint.sikayetNo} no ile daha önce kaydedildi.`,
          complaintId: existing.complaintId ?? undefined,
          classification,
          skipped: true,
        };
      }
      return {
        reply: "Mesajınız daha önce alındı. Operatörümüz size dönüş yapacaktır.",
        classification,
        skipped: true,
      };
    }
  }

  if (job.mediaError && !job.medyaUrl) {
    const classification: Classification = {
      intent: "diger",
      sikayet_turu: null,
      mahalle: null,
      adres: null,
      aciklama_ozeti: job.icerik,
      oncelik: "NORMAL",
      guven: 0,
    };
    const reply = mediaErrorReply(job.mediaError);
    const msg = await prisma.whatsAppMessage.create({
      data: {
        telefon: job.telefon,
        yon: "GELEN",
        icerik: job.icerik,
        medyaTipi: job.medyaTipi,
        waMessageId: job.waMessageId,
        aiSonuc: classification,
        guven: 0,
        botYaniti: reply,
      },
    });
    return { reply, classification, messageId: msg.id };
  }

  const session = await getSession(job.telefon);
  const prior = session?.draft.classification ?? null;

  const turn = await classifyMessage(
    job.icerik,
    job.medyaUrl && job.mimeType
      ? { filePath: job.medyaUrl, mimeType: job.mimeType }
      : null,
    prior,
  );

  // Interrupt intents — do not consume draft
  if (turn.intent === "durum_sorgu") {
    const msg = await prisma.whatsAppMessage.create({
      data: {
        telefon: job.telefon,
        yon: "GELEN",
        icerik: job.icerik,
        medyaUrl: job.medyaUrl,
        medyaTipi: job.medyaTipi,
        waMessageId: job.waMessageId,
        aiSonuc: turn,
        guven: turn.guven,
      },
    });
    const open = await prisma.complaint.findFirst({
      where: {
        telefon: { contains: job.telefon.replace(/\D/g, "").slice(-10) },
        durum: { in: ["ACIK", "DEVAM_EDIYOR"] },
      },
      orderBy: { kayitTarihi: "desc" },
      include: { department: true },
    });
    if (!open) {
      return yanit(msg.id, {
        reply: "Açık şikayet kaydınız bulunamadı. Yeni bir talep iletebilirsiniz.",
        classification: turn,
      });
    }
    return yanit(msg.id, {
      reply: `Şikayetiniz ${open.sikayetNo}: durum ${open.durum}${open.department ? `, ${open.department.name}` : ""}.`,
      complaintId: open.id,
      classification: turn,
    });
  }

  if (turn.intent === "tesekkur") {
    const reply = "Rica ederiz. İyi günler dileriz.";
    const msg = await prisma.whatsAppMessage.create({
      data: {
        telefon: job.telefon,
        yon: "GELEN",
        icerik: job.icerik,
        medyaUrl: job.medyaUrl,
        medyaTipi: job.medyaTipi,
        waMessageId: job.waMessageId,
        aiSonuc: turn,
        guven: turn.guven,
        botYaniti: reply,
      },
    });
    return { reply, classification: turn, messageId: msg.id };
  }

  // Build / update draft
  let draft: SessionDraft;
  if (session && looksLikeSlotFill(job.icerik, session.awaiting, turn)) {
    draft = {
      ...session.draft,
      classification: mergeDraft(session.draft.classification, turn, job.icerik),
      sourceMessageIds: [
        ...(session.draft.sourceMessageIds ?? []),
        ...(job.waMessageId ? [job.waMessageId] : []),
      ],
    };
    if (session.awaiting === "ADRES") {
      draft.askedAdres = true;
      if (isAdresSkip(job.icerik)) {
        // keep adres null
      } else if (!draft.classification.adres && job.icerik.trim().length >= 3) {
        draft.classification = {
          ...draft.classification,
          adres: job.icerik.trim().slice(0, 160),
        };
      }
    }
  } else if (turn.intent === "sikayet" || session) {
    if (session && !isFullNewComplaint(turn)) {
      draft = {
        ...session.draft,
        classification: mergeDraft(session.draft.classification, turn, job.icerik),
        sourceMessageIds: [
          ...(session.draft.sourceMessageIds ?? []),
          ...(job.waMessageId ? [job.waMessageId] : []),
        ],
      };
    } else if (turn.intent === "sikayet") {
      draft = emptyDraft(turn);
      draft.sourceMessageIds = job.waMessageId ? [job.waMessageId] : [];
    } else {
      // Non-complaint outside active fill
      return karsilamaYaniti(job, turn);
    }
  } else {
    return karsilamaYaniti(job, turn);
  }

  const classification = { ...draft.classification, intent: "sikayet" as const };
  draft = { ...draft, classification };

  const awaiting = nextAwaiting(draft);

  const msg = await prisma.whatsAppMessage.create({
    data: {
      telefon: job.telefon,
      yon: "GELEN",
      icerik: job.icerik,
      medyaUrl: job.medyaUrl,
      medyaTipi: job.medyaTipi,
      waMessageId: job.waMessageId,
      aiSonuc: classification,
      guven: classification.guven,
      onayDurumu: awaiting ? "ONAY_BEKLIYOR" : undefined,
    },
  });

  if (awaiting) {
    if (awaiting === "ADRES") {
      draft = { ...draft, askedAdres: true };
    }
    await upsertSession(job.telefon, draft, awaiting);
    return yanit(msg.id, {
      reply: replyForAwaiting(awaiting),
      classification,
    });
  }

  // Complete — create or operator queue
  await clearSession(job.telefon);

  if (classification.guven < THRESHOLD) {
    const reply =
      "Bilgileriniz alındı. Operatörümüz kısa süre içinde kontrol edip size dönüş yapacaktır.";
    await prisma.whatsAppMessage.update({
      where: { id: msg.id },
      data: { onayDurumu: "ONAY_BEKLIYOR", botYaniti: reply },
    });
    return { reply, classification, messageId: msg.id };
  }

  const complaint = await createComplaintFromAi(job.telefon, classification);
  const reply = `Şikayetiniz ${complaint.sikayetNo} no ile kaydedildi${
    complaint.departmentName ? `, ${complaint.departmentName}'ne iletildi` : ""
  }.`;
  await prisma.whatsAppMessage.update({
    where: { id: msg.id },
    data: {
      complaintId: complaint.id,
      onayDurumu: "OTOMATIK",
      botYaniti: reply,
    },
  });

  return { reply, complaintId: complaint.id, classification, messageId: msg.id };
}

async function createComplaintFromAi(
  telefon: string,
  ai: Classification,
): Promise<{ id: string; sikayetNo: string; departmentName?: string }> {
  const [tur, mahalle] = await Promise.all([
    ai.sikayet_turu
      ? prisma.complaintType.findFirst({
          where: { name: { equals: ai.sikayet_turu, mode: "insensitive" } },
          include: { defaultDepartment: true },
        })
      : null,
    ai.mahalle
      ? prisma.neighborhood.findFirst({
          where: { name: { equals: ai.mahalle, mode: "insensitive" } },
        })
      : null,
  ]);

  // Konum pini alınmaz (KVKK); mesajdan çıkan mahalle/adres geocode edilir
  const geo = await geocodeKarsAdres({
    mahalle: mahalle?.name ?? ai.mahalle,
    adres: ai.adres,
  });

  return withSerialRetry(prisma, async (tx) => {
    const { yil, sira, sikayetNo } = await nextComplaintSerial(tx);
    const created = await tx.complaint.create({
      data: {
        sikayetNo,
        yil,
        sira,
        kanal: "WHATSAPP",
        arayanKisi: telefon,
        telefon,
        neighborhoodId: mahalle?.id,
        acikAdres: ai.adres ?? undefined,
        complaintTypeId: tur?.id,
        departmentId: tur?.defaultDepartmentId,
        aciklama: ai.aciklama_ozeti ?? undefined,
        oncelik: ai.oncelik,
        durum: "ACIK",
        ...(geo ? { lat: geo.lat, lng: geo.lng } : {}),
      },
      include: { department: true },
    });
    await tx.complaintEvent.create({
      data: {
        complaintId: created.id,
        tip: "WHATSAPP_AUTO",
        detay: {
          ...(ai as object),
          ...(geo
            ? {
                konum: {
                  kaynak: "geocode",
                  displayName: geo.displayName,
                  lat: geo.lat,
                  lng: geo.lng,
                },
              }
            : {}),
        },
      },
    });
    return {
      id: created.id,
      sikayetNo: created.sikayetNo,
      departmentName: created.department?.name,
    };
  });
}
