import { nextComplaintSerial, prisma, withSerialRetry } from "@kars/db";
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

const THRESHOLD = Number(process.env.WHATSAPP_AUTO_CONFIDENCE_THRESHOLD ?? "0.75");

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
};

function mediaErrorReply(code?: MediaErrorCode): string {
  if (code === "too_large") {
    return "Gönderdiğiniz dosya çok büyük (en fazla 8 MB). Lütfen daha küçük bir fotoğraf/ses gönderin veya şikayetinizi yazın.";
  }
  return "Medya alınamadı. Lütfen fotoğraf veya sesli mesajı tekrar gönderin ya da şikayetinizi yazın.";
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
    await prisma.whatsAppMessage.create({
      data: {
        telefon: job.telefon,
        yon: "GELEN",
        icerik: job.icerik,
        medyaTipi: job.medyaTipi,
        waMessageId: job.waMessageId,
        aiSonuc: classification,
        guven: 0,
      },
    });
    return {
      reply: mediaErrorReply(job.mediaError),
      classification,
    };
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
    await prisma.whatsAppMessage.create({
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
      return {
        reply: "Açık şikayet kaydınız bulunamadı. Yeni bir talep iletebilirsiniz.",
        classification: turn,
      };
    }
    return {
      reply: `Şikayetiniz ${open.sikayetNo}: durum ${open.durum}${open.department ? `, ${open.department.name}` : ""}.`,
      complaintId: open.id,
      classification: turn,
    };
  }

  if (turn.intent === "tesekkur") {
    await prisma.whatsAppMessage.create({
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
    return { reply: "Rica ederiz. İyi günler dileriz.", classification: turn };
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
      await prisma.whatsAppMessage.create({
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
      return {
        reply:
          "Kars Belediyesi WhatsApp hattına hoş geldiniz. Şikayet veya talebinizi mahalle ve adres bilgisiyle yazabilirsiniz; fotoğraf veya sesli mesaj da gönderebilirsiniz. Açık şikayet durumu için 'durum' yazın.",
        classification: turn,
      };
    }
  } else {
    await prisma.whatsAppMessage.create({
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
    return {
      reply:
        "Kars Belediyesi WhatsApp hattına hoş geldiniz. Şikayet veya talebinizi mahalle ve adres bilgisiyle yazabilirsiniz; fotoğraf veya sesli mesaj da gönderebilirsiniz. Açık şikayet durumu için 'durum' yazın.",
      classification: turn,
    };
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
    return {
      reply: replyForAwaiting(awaiting),
      classification,
    };
  }

  // Complete — create or operator queue
  await clearSession(job.telefon);

  if (classification.guven < THRESHOLD) {
    await prisma.whatsAppMessage.update({
      where: { id: msg.id },
      data: { onayDurumu: "ONAY_BEKLIYOR" },
    });
    return {
      reply:
        "Bilgileriniz alındı. Operatörümüz kısa süre içinde kontrol edip size dönüş yapacaktır.",
      classification,
    };
  }

  const complaint = await createComplaintFromAi(job.telefon, classification);
  await prisma.whatsAppMessage.update({
    where: { id: msg.id },
    data: {
      complaintId: complaint.id,
      onayDurumu: "OTOMATIK",
    },
  });

  return {
    reply: `Şikayetiniz ${complaint.sikayetNo} no ile kaydedildi${
      complaint.departmentName ? `, ${complaint.departmentName}'ne iletildi` : ""
    }.`,
    complaintId: complaint.id,
    classification,
  };
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
      },
      include: { department: true },
    });
    await tx.complaintEvent.create({
      data: {
        complaintId: created.id,
        tip: "WHATSAPP_AUTO",
        detay: ai as object,
      },
    });
    return {
      id: created.id,
      sikayetNo: created.sikayetNo,
      departmentName: created.department?.name,
    };
  });
}
