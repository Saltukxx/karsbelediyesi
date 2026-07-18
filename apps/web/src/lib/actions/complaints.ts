"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { nextComplaintSerial, prisma, withSerialRetry } from "@kars/db";
import { canAccessComplaint, loadComplaintForAccess, toAccessUser } from "@/lib/access";
import { canTransitionComplaint } from "@/lib/domain/complaint-status";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";

const yeniSikayetSchema = z.object({
  arayanKisi: z.string().min(1, "Arayan kişi zorunlu"),
  telefon: z.string().optional(),
  neighborhoodId: z.string().optional(),
  acikAdres: z.string().optional(),
  complaintTypeId: z.string().optional(),
  aciklama: z.string().optional(),
  departmentId: z.string().optional(),
  oncelik: z.enum(["NORMAL", "ACIL", "COK_ACIL"]).default("NORMAL"),
  vehicleId: z.string().optional(),
  personnelIds: z.array(z.string()).default([]),
  kanal: z.enum(["TELEFON", "WHATSAPP", "WEB"]).default("TELEFON"),
});

export async function sikayetOlustur(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.complaints);

  const parsed = yeniSikayetSchema.parse({
    arayanKisi: formData.get("arayanKisi"),
    telefon: formData.get("telefon") || undefined,
    neighborhoodId: formData.get("neighborhoodId") || undefined,
    acikAdres: formData.get("acikAdres") || undefined,
    complaintTypeId: formData.get("complaintTypeId") || undefined,
    aciklama: formData.get("aciklama") || undefined,
    departmentId: formData.get("departmentId") || undefined,
    oncelik: formData.get("oncelik") || "NORMAL",
    vehicleId: formData.get("vehicleId") || undefined,
    personnelIds: formData.getAll("personnelIds").map(String).filter(Boolean),
    kanal: "TELEFON",
  });

  // Tür seçilmiş ama müdürlük seçilmemişse: tür→müdürlük eşlemesi (Excel/AI yönlendirme kuralı)
  let departmentId = parsed.departmentId;
  if (!departmentId && parsed.complaintTypeId) {
    const tur = await prisma.complaintType.findUnique({
      where: { id: parsed.complaintTypeId },
    });
    departmentId = tur?.defaultDepartmentId ?? undefined;
  }

  // Plaka seçildiyse şoför bilgisi araç zimmetinden gelir (Excel VLOOKUP davranışı)
  let soforAdi: string | undefined;
  let soforTelefonu: string | undefined;
  if (parsed.vehicleId) {
    const arac = await prisma.vehicle.findUnique({
      where: { id: parsed.vehicleId },
      include: { atananSofor: true },
    });
    soforAdi = arac?.atananSofor?.name;
    soforTelefonu = arac?.atananSofor?.phone;
  }

  const created = await withSerialRetry(prisma, async (tx) => {
    const { yil, sira, sikayetNo } = await nextComplaintSerial(tx);
    return tx.complaint.create({
      data: {
        sikayetNo,
        yil,
        sira,
        kanal: parsed.kanal,
        arayanKisi: parsed.arayanKisi,
        telefon: parsed.telefon,
        neighborhoodId: parsed.neighborhoodId,
        acikAdres: parsed.acikAdres,
        complaintTypeId: parsed.complaintTypeId,
        aciklama: parsed.aciklama,
        departmentId,
        oncelik: parsed.oncelik,
        vehicleId: parsed.vehicleId,
        soforAdi,
        soforTelefonu,
        personel: {
          create: parsed.personnelIds.map((personnelId) => ({ personnelId })),
        },
        events: {
          create: {
            userId: session.user.id,
            tip: "OLUSTURULDU",
            detay: { kanal: parsed.kanal },
          },
        },
      },
    });
  });

  revalidatePath("/sikayetler");
  redirect(`/sikayetler/${created.id}`);
}

const durumSchema = z.enum(["ACIK", "DEVAM_EDIYOR", "KAPATILDI", "IPTAL"]);

export async function sikayetDurumGuncelle(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.complaints);

  const id = String(formData.get("id"));
  const durum = durumSchema.parse(formData.get("durum"));
  const cozumNotu = (formData.get("cozumNotu") as string) || undefined;

  const eski = await loadComplaintForAccess(id);
  if (!eski || !canAccessComplaint(toAccessUser(session.user), eski)) {
    throw new Error("Yetkisiz");
  }

  const transition = canTransitionComplaint(eski.durum, durum, session.user.role);
  if (!transition.ok) throw new Error(transition.error);

  await prisma.complaint.update({
    where: { id },
    data: {
      durum,
      ...(durum === "KAPATILDI"
        ? { kapanisTarihi: new Date(), cozumNotu, onaylayanId: session.user.id }
        : {}),
      events: {
        create: {
          userId: session.user.id,
          tip: "DURUM_DEGISTI",
          detay: { eski: eski.durum, yeni: durum, cozumNotu },
        },
      },
    },
  });

  revalidatePath(`/sikayetler/${id}`);
  revalidatePath("/sikayetler");
  revalidatePath("/");
}

export async function sikayetAta(formData: FormData) {
  const session = await requireRoles(ACTION_ROLES.complaints);

  const id = String(formData.get("id"));
  const vehicleId = (formData.get("vehicleId") as string) || null;
  const personnelIds = formData.getAll("personnelIds").map(String).filter(Boolean);

  const mevcut = await loadComplaintForAccess(id);
  if (!mevcut || !canAccessComplaint(toAccessUser(session.user), mevcut)) {
    throw new Error("Yetkisiz");
  }

  let soforAdi: string | null = null;
  let soforTelefonu: string | null = null;
  if (vehicleId) {
    const arac = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { atananSofor: true },
    });
    soforAdi = arac?.atananSofor?.name ?? null;
    soforTelefonu = arac?.atananSofor?.phone ?? null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.complaintPersonnel.deleteMany({ where: { complaintId: id } });
    await tx.complaint.update({
      where: { id },
      data: {
        vehicleId,
        soforAdi,
        soforTelefonu,
        durum: "DEVAM_EDIYOR",
        personel: { create: personnelIds.map((personnelId) => ({ personnelId })) },
        events: {
          create: {
            userId: session.user.id,
            tip: "GOREVLENDIRME",
            detay: { vehicleId, personnelIds },
          },
        },
      },
    });
  });

  revalidatePath(`/sikayetler/${id}`);
  revalidatePath("/sikayetler");
}
