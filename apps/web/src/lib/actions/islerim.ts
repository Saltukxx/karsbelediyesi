"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@kars/db";
import type { AsfaltDurum, SikayetDurum } from "@kars/db";
import { canTransitionComplaint } from "@/lib/domain/complaint-status";
import { requireSession } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";
import { bildirimGonder, kullaniciIdleri } from "@/lib/notify";

const SIKAYET_DURUMLAR: SikayetDurum[] = ["ACIK", "DEVAM_EDIYOR", "KAPATILDI", "IPTAL"];
const ASFALT_DURUMLAR: AsfaltDurum[] = ["PLANLANDI", "DEVAM_EDIYOR", "TAMAMLANDI"];

/** Oturumdaki kullanıcının personel kaydı (yoksa hata) */
async function oturumPersoneli(userId: string) {
  const personel = await prisma.personnel.findFirst({
    where: { userId },
    select: { id: true, adSoyad: true },
  });
  if (!personel) throw new Error("Hesabınıza bağlı personel kaydı bulunamadı");
  return personel;
}

/** Kendisine atanan şikayetin durumunu günceller (saha personeli) */
export async function islerimSikayetDurum(formData: FormData) {
  const session = await requireSession();
  const personel = await oturumPersoneli(session.user.id);

  const id = String(formData.get("id"));
  const durumRaw = String(formData.get("durum"));
  if (!SIKAYET_DURUMLAR.includes(durumRaw as SikayetDurum)) {
    throw new Error("Geçersiz durum");
  }
  const durum = durumRaw as SikayetDurum;
  const cozumNotu = (formData.get("cozumNotu") as string)?.trim() || undefined;

  const atama = await prisma.complaintPersonnel.findUnique({
    where: { complaintId_personnelId: { complaintId: id, personnelId: personel.id } },
    include: { complaint: true },
  });
  if (!atama) throw new Error("Bu şikayet size atanmamış");

  const eski = atama.complaint;
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
          detay: { eski: eski.durum, yeni: durum, cozumNotu, kaynak: "islerim" },
        },
      },
    },
  });

  await auditKaydet(session, "ISLERIM_SIKAYET_DURUM", {
    varlik: "Complaint",
    varlikId: id,
    detay: { sikayetNo: eski.sikayetNo, eski: eski.durum, yeni: durum },
  });

  if (eski.departmentId && durum !== eski.durum) {
    const yoneticiler = await kullaniciIdleri(["DEPARTMENT_MANAGER"], eski.departmentId);
    await bildirimGonder(
      yoneticiler.filter((uid) => uid !== session.user.id),
      {
        tip: "GOREV",
        baslik: `${eski.sikayetNo} durumu güncellendi`,
        mesaj: `${personel.adSoyad}: ${eski.durum} → ${durum}`,
        href: `/sikayetler/${id}`,
      },
    );
  }

  revalidatePath("/islerim");
  revalidatePath(`/islerim/${id}`);
  revalidatePath(`/sikayetler/${id}`);
  revalidatePath("/sikayetler");
}

/** Kendisine atanan asfalt rotasının durumunu günceller (saha personeli) */
export async function islerimAsfaltDurum(formData: FormData) {
  const session = await requireSession();
  const personel = await oturumPersoneli(session.user.id);

  const id = String(formData.get("id"));
  const durumRaw = String(formData.get("durum"));
  if (!ASFALT_DURUMLAR.includes(durumRaw as AsfaltDurum)) {
    throw new Error("Geçersiz durum");
  }

  const atama = await prisma.asphaltRoadPersonnel.findUnique({
    where: { asphaltRoadId_personnelId: { asphaltRoadId: id, personnelId: personel.id } },
    include: { asphaltRoad: { select: { ad: true, departmentId: true, durum: true } } },
  });
  if (!atama) throw new Error("Bu rota size atanmamış");

  const durum = durumRaw as AsfaltDurum;
  await prisma.asphaltRoad.update({ where: { id }, data: { durum } });

  await auditKaydet(session, "ISLERIM_ASFALT_DURUM", {
    varlik: "AsphaltRoad",
    varlikId: id,
    detay: { ad: atama.asphaltRoad.ad, eski: atama.asphaltRoad.durum, yeni: durum },
  });

  if (atama.asphaltRoad.departmentId && durum !== atama.asphaltRoad.durum) {
    const yoneticiler = await kullaniciIdleri(
      ["DEPARTMENT_MANAGER"],
      atama.asphaltRoad.departmentId,
    );
    await bildirimGonder(
      yoneticiler.filter((uid) => uid !== session.user.id),
      {
        tip: "GOREV",
        baslik: `"${atama.asphaltRoad.ad}" rota durumu güncellendi`,
        mesaj: `${personel.adSoyad}: ${atama.asphaltRoad.durum} → ${durum}`,
        href: "/harita",
      },
    );
  }

  revalidatePath("/islerim");
  revalidatePath("/harita");
}
