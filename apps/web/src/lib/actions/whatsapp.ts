"use server";

import { revalidatePath } from "next/cache";
import { nextComplaintSerial, prisma, withSerialRetry } from "@kars/db";
import { geocodeKarsAdres } from "@kars/shared";
import { ACTION_ROLES, requireRoles, requireSession } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";
import { bildirimGonder, kullaniciIdleri } from "@/lib/notify";
import { whatsappCevapGonderForUser } from "@/lib/domain/whatsapp-reply";

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
  const acikAdres = bos(formData.get("adres")) ?? ai.adres;
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

  // Operatör mahalle/adresi değiştirdiyse güncel metinle geocode; konum pini alınmaz
  const geo = await geocodeKarsAdres({
    mahalle: mahalle?.name ?? mahalleAdi,
    adres: acikAdres,
  });

  const complaint = await withSerialRetry(prisma, async (tx) => {
    // Satırı transaction içinde sahiplen: eşzamanlı iki onay çift şikayet açardı.
    // Kilit complaintId üzerinden alınır; onayDurumu boş olan mesajlar da onaylanabilir.
    const claim = await tx.whatsAppMessage.updateMany({
      where: { id, complaintId: null },
      data: { onayDurumu: "ONAYLANDI" },
    });
    if (claim.count === 0) return null;

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
        acikAdres,
        complaintTypeId: tur?.id,
        departmentId: tur?.defaultDepartmentId,
        aciklama,
        oncelik,
        durum: "ACIK",
        ...(geo ? { lat: geo.lat, lng: geo.lng } : {}),
      },
    });
    await tx.whatsAppMessage.update({
      where: { id },
      data: { complaintId: created.id },
    });
    await tx.complaintEvent.create({
      data: {
        complaintId: created.id,
        userId: session.user.id,
        tip: "WHATSAPP_ONAY",
        detay: {
          messageId: id,
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
    return created;
  });

  if (!complaint) throw new Error("Bu mesaj zaten onaylanmış");

  await auditKaydet(session, "WHATSAPP_ONAYLA", {
    varlik: "Complaint",
    varlikId: complaint.id,
    detay: { sikayetNo: complaint.sikayetNo, messageId: id },
  });

  if (complaint.departmentId) {
    const yoneticiler = await kullaniciIdleri(
      ["DEPARTMENT_MANAGER"],
      complaint.departmentId,
    );
    await bildirimGonder(
      yoneticiler.filter((uid) => uid !== session.user.id),
      {
        tip: "ONAY",
        baslik: `WhatsApp şikayeti onaylandı: ${complaint.sikayetNo}`,
        mesaj: aciklama.slice(0, 120) || undefined,
        href: `/sikayetler/${complaint.id}`,
      },
    );
  }

  revalidatePath("/whatsapp");
  revalidatePath("/sikayetler");
  revalidatePath(`/sikayetler/${complaint.id}`);
  revalidatePath("/");
}

/**
 * Vatandaşa WhatsApp üzerinden serbest metin cevap gönderir.
 * Yetki: ADMIN, şikayetin müdürlük yöneticisi veya şikayete atanmış personelin kullanıcısı.
 */
export async function whatsappCevapGonder(formData: FormData) {
  const session = await requireSession();
  await whatsappCevapGonderForUser(session, {
    complaintId: String(formData.get("complaintId")),
    text: String(formData.get("text") ?? ""),
  });
  revalidatePath("/islerim");
  revalidatePath(`/sikayetler/${String(formData.get("complaintId"))}`);
}

export async function whatsappReddet(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.whatsapp);
  const id = String(formData.get("id"));
  // Onaylanıp şikayete dönüşmüş mesaj reddedilirse kuyruk ile şikayet çelişir
  const red = await prisma.whatsAppMessage.updateMany({
    where: { id, complaintId: null },
    data: { onayDurumu: "REDDEDILDI" },
  });
  if (red.count === 0) throw new Error("Bu mesaj onaylanmış, reddedilemez");
  await auditKaydet(session, "WHATSAPP_REDDET", {
    varlik: "WhatsAppMessage",
    varlikId: id,
  });
  revalidatePath("/whatsapp");
  revalidatePath("/");
}
