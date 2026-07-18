import { nextComplaintSerial, prisma, withSerialRetry } from "@kars/db";
import { classifyMessage, type Classification } from "./classify.js";
import type { MediaErrorCode } from "./media.js";

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

  const classification = await classifyMessage(
    job.icerik,
    job.medyaUrl && job.mimeType
      ? { filePath: job.medyaUrl, mimeType: job.mimeType }
      : null,
  );

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
      onayDurumu:
        classification.intent === "sikayet" && classification.guven >= THRESHOLD
          ? "OTOMATIK"
          : classification.intent === "sikayet"
            ? "ONAY_BEKLIYOR"
            : undefined,
    },
  });

  if (classification.intent === "durum_sorgu") {
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
        classification,
      };
    }
    return {
      reply: `Şikayetiniz ${open.sikayetNo}: durum ${open.durum}${open.department ? `, ${open.department.name}` : ""}.`,
      complaintId: open.id,
      classification,
    };
  }

  if (classification.intent === "tesekkur") {
    return { reply: "Rica ederiz. İyi günler dileriz.", classification };
  }

  if (classification.intent !== "sikayet") {
    return {
      reply:
        "Kars Belediyesi WhatsApp hattına hoş geldiniz. Şikayet veya talebinizi mahalle ve adres bilgisiyle yazabilirsiniz; fotoğraf veya sesli mesaj da gönderebilirsiniz. Açık şikayet durumu için 'durum' yazın.",
      classification,
    };
  }

  if (!classification.mahalle) {
    await prisma.whatsAppMessage.update({
      where: { id: msg.id },
      data: { onayDurumu: "ONAY_BEKLIYOR" },
    });
    return {
      reply:
        "Şikayetinizi almak için mahalle bilgisini yazar mısınız? (örn. Yenişehir)",
      classification,
    };
  }

  if (classification.guven < THRESHOLD) {
    return {
      reply:
        "Mesajınız alındı. Operatörümüz kısa süre içinde kontrol edip size dönüş yapacaktır.",
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
