import { prisma } from "@kars/db";
import type { AppSession } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";
import { whatsappMesajKuyrugaEkle, yeniOutboundKey } from "@/lib/whatsapp-outbound";

export async function whatsappCevapGonderForUser(
  session: AppSession,
  input: { complaintId: string; text: string },
) {
  const text = input.text.trim();
  if (!text) throw new Error("Mesaj boş olamaz");
  if (text.length > 2000) throw new Error("Mesaj çok uzun (en fazla 2000 karakter)");

  const complaint = await prisma.complaint.findUnique({
    where: { id: input.complaintId },
    include: { personel: { include: { personnel: { select: { userId: true } } } } },
  });
  if (!complaint) throw new Error("Şikayet bulunamadı");
  if (!complaint.telefon) throw new Error("Şikayette telefon numarası yok");

  const { role, id: userId, departmentId } = session.user;
  const atanmisPersonel = complaint.personel.some((p) => p.personnel?.userId === userId);
  const mudurYetkili =
    role === "DEPARTMENT_MANAGER" &&
    !!departmentId &&
    complaint.departmentId === departmentId;
  if (role !== "ADMIN" && !mudurYetkili && !atanmisPersonel) {
    throw new Error("Bu şikayete cevap yazma yetkiniz yok");
  }

  const outboundKey = yeniOutboundKey();
  const mesaj = await prisma.$transaction(async (tx) => {
    const created = await tx.whatsAppMessage.create({
      data: {
        telefon: complaint.telefon!,
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
      telefon: complaint.telefon,
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
    throw new Error("Mesaj kuyruğa alınamadı, lütfen tekrar deneyin");
  }

  await auditKaydet(session, "WHATSAPP_CEVAP_GONDER", {
    varlik: "Complaint",
    varlikId: complaint.id,
    detay: { sikayetNo: complaint.sikayetNo },
  });
  return { ok: true, id: mesaj.id };
}
