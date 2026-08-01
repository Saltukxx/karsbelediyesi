import { z } from "zod";
import { prisma } from "@kars/db";
import { auditKaydet } from "@/lib/audit";
import { ServiceError, type ServiceActor } from "@/lib/services/base";
import { whatsappMesajKuyrugaEkle, yeniOutboundKey } from "@/lib/whatsapp-outbound";

export const whatsappCevapInputSchema = z.object({
  text: z.string().trim().min(1, "Mesaj boş olamaz").max(2000, "Mesaj çok uzun (en fazla 2000 karakter)"),
});

export type WhatsappCevapInput = z.input<typeof whatsappCevapInputSchema>;

/**
 * Vatandaşa WhatsApp üzerinden serbest metin cevap gönderir.
 * Yetki rol listesiyle değil ilişkiyle belirlenir: ADMIN, şikayetin müdürlük
 * yöneticisi veya şikayete atanmış personelin kullanıcısı.
 */
export async function whatsappCevapla(
  actor: ServiceActor,
  complaintId: string,
  input: unknown,
) {
  const { text } = whatsappCevapInputSchema.parse(input);

  const complaint = await prisma.complaint.findUnique({
    where: { id: complaintId },
    include: { personel: { include: { personnel: { select: { userId: true } } } } },
  });
  if (!complaint) throw new ServiceError("Şikayet bulunamadı", 404);
  const telefon = complaint.telefon;
  if (!telefon) throw new ServiceError("Şikayette telefon numarası yok");

  const { role, id: userId, departmentId } = actor.user;
  const atanmisPersonel = complaint.personel.some((p) => p.personnel?.userId === userId);
  const mudurYetkili =
    role === "DEPARTMENT_MANAGER" &&
    !!departmentId &&
    complaint.departmentId === departmentId;
  if (role !== "ADMIN" && !mudurYetkili && !atanmisPersonel) {
    throw new ServiceError("Bu şikayete cevap yazma yetkiniz yok", 403);
  }

  // Önce kayıt, sonra kuyruk: kuyruk hatası mesajın izini kaybettirmesin
  const outboundKey = yeniOutboundKey();
  const mesaj = await prisma.$transaction(async (tx) => {
    const created = await tx.whatsAppMessage.create({
      data: {
        telefon,
        yon: "GIDEN",
        icerik: text,
        complaintId: complaint.id,
        sentByUserId: userId,
        outboundKey,
        gonderimDurumu: "KUYRUKTA",
      },
    });
    await tx.complaintEvent.create({
      data: {
        complaintId: complaint.id,
        userId,
        tip: "WHATSAPP_CEVAP",
        detay: { mesaj: text.slice(0, 200), outboundKey },
      },
    });
    return created;
  });

  try {
    await whatsappMesajKuyrugaEkle({
      telefon,
      text,
      complaintId: complaint.id,
      sentByUserId: userId,
      outboundKey,
    });
  } catch (err) {
    await prisma.whatsAppMessage.update({
      where: { id: mesaj.id },
      data: { gonderimDurumu: "BASARISIZ" },
    });
    console.error("WhatsApp kuyruğa eklenemedi", { outboundKey, err });
    throw new ServiceError("Mesaj kuyruğa alınamadı, lütfen tekrar deneyin", 502);
  }

  await auditKaydet(actor, "WHATSAPP_CEVAP_GONDER", {
    varlik: "Complaint",
    varlikId: complaint.id,
    detay: { sikayetNo: complaint.sikayetNo },
  });

  return {
    id: mesaj.id,
    yon: mesaj.yon,
    icerik: mesaj.icerik,
    gonderimDurumu: mesaj.gonderimDurumu,
    createdAt: mesaj.createdAt.toISOString(),
  };
}
