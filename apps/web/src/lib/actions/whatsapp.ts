"use server";

import { revalidatePath } from "next/cache";
import { nextComplaintSerial, prisma, withSerialRetry } from "@kars/db";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";

function bos(v: FormDataEntryValue | null): string | undefined {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? undefined : s;
}

type AiSonuc = {
  intent?: string;
  sikayet_turu?: string;
  mahalle?: string;
  adres?: string;
  aciklama_ozeti?: string;
  oncelik?: "NORMAL" | "ACIL" | "COK_ACIL";
  guven?: number;
};

export async function whatsappOnayla(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.whatsapp);

  const id = String(formData.get("id"));
  const msg = await prisma.whatsAppMessage.findUniqueOrThrow({ where: { id } });
  const ai = (msg.aiSonuc ?? {}) as AiSonuc;

  const turAdi = bos(formData.get("sikayetTuru")) ?? ai.sikayet_turu;
  const mahalleAdi = bos(formData.get("mahalle")) ?? ai.mahalle;
  const oncelik = (bos(formData.get("oncelik")) ?? ai.oncelik ?? "NORMAL") as
    | "NORMAL"
    | "ACIL"
    | "COK_ACIL";
  const aciklama = bos(formData.get("aciklama")) ?? ai.aciklama_ozeti ?? msg.icerik ?? "";

  const [tur, mahalle] = await Promise.all([
    turAdi
      ? prisma.complaintType.findFirst({
          where: { name: { equals: turAdi, mode: "insensitive" } },
        })
      : null,
    mahalleAdi
      ? prisma.neighborhood.findFirst({
          where: { name: { equals: mahalleAdi, mode: "insensitive" } },
        })
      : null,
  ]);

  const complaint = await withSerialRetry(prisma, async (tx) => {
    const { yil, sira, sikayetNo } = await nextComplaintSerial(tx);
    const created = await tx.complaint.create({
      data: {
        sikayetNo,
        yil,
        sira,
        kanal: "WHATSAPP",
        arayanKisi: msg.telefon,
        telefon: msg.telefon,
        neighborhoodId: mahalle?.id,
        acikAdres: ai.adres ?? bos(formData.get("adres")),
        complaintTypeId: tur?.id,
        departmentId: tur?.defaultDepartmentId,
        aciklama,
        oncelik,
        durum: "ACIK",
      },
    });
    await tx.whatsAppMessage.update({
      where: { id },
      data: { onayDurumu: "ONAYLANDI", complaintId: created.id },
    });
    await tx.complaintEvent.create({
      data: {
        complaintId: created.id,
        userId: session.user.id,
        tip: "WHATSAPP_ONAY",
        detay: { messageId: id },
      },
    });
    return created;
  });

  revalidatePath("/whatsapp");
  revalidatePath("/sikayetler");
  revalidatePath(`/sikayetler/${complaint.id}`);
  revalidatePath("/");
}

export async function whatsappReddet(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.whatsapp);
  const id = String(formData.get("id"));
  await prisma.whatsAppMessage.update({
    where: { id },
    data: { onayDurumu: "REDDEDILDI" },
  });
  revalidatePath("/whatsapp");
  revalidatePath("/");
}
