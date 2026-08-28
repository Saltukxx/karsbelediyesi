import { prisma } from "@kars/db";
import type { AsfaltDurum, SikayetDurum } from "@kars/db";
import { canTransitionAsfalt } from "@/lib/domain/asfalt-status";
import { canTransitionComplaint } from "@/lib/domain/complaint-status";
import type { AppSession } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";
import { bildirimGonder, kullaniciIdleri } from "@/lib/notify";
import {
  cleanupComplaintPhotoFiles,
  saveComplaintPhotosFromBase64,
} from "@/lib/complaint-photos";

const SIKAYET_DURUMLAR: SikayetDurum[] = ["ACIK", "DEVAM_EDIYOR", "KAPATILDI", "IPTAL"];
const ASFALT_DURUMLAR: AsfaltDurum[] = ["PLANLANDI", "DEVAM_EDIYOR", "TAMAMLANDI"];

export async function oturumPersoneli(userId: string) {
  const personel = await prisma.personnel.findFirst({
    where: { userId },
    select: { id: true, adSoyad: true },
  });
  if (!personel) throw new Error("Hesabınıza bağlı personel kaydı bulunamadı");
  return personel;
}

export async function islerimListesiForUser(session: AppSession) {
  const personel = await oturumPersoneli(session.user.id);
  const [sikayetler, asfalt] = await Promise.all([
    prisma.complaintPersonnel.findMany({
      where: {
        personnelId: personel.id,
        complaint: { durum: { in: ["ACIK", "DEVAM_EDIYOR"] } },
      },
      include: {
        complaint: {
          include: {
            neighborhood: { select: { id: true, name: true } },
            complaintType: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { complaint: { kayitTarihi: "desc" } },
    }),
    prisma.asphaltRoadPersonnel.findMany({
      where: {
        personnelId: personel.id,
        asphaltRoad: { durum: { in: ["PLANLANDI", "DEVAM_EDIYOR"] } },
      },
      include: { asphaltRoad: true },
    }),
  ]);
  return {
    personel,
    sikayetler: sikayetler.map((a) => ({
      id: a.complaint.id,
      sikayetNo: a.complaint.sikayetNo,
      durum: a.complaint.durum,
      arayanKisi: a.complaint.arayanKisi,
      telefon: a.complaint.telefon,
      aciklama: a.complaint.aciklama,
      acikAdres: a.complaint.acikAdres,
      neighborhood: a.complaint.neighborhood,
      complaintType: a.complaint.complaintType,
      lat: a.complaint.lat,
      lng: a.complaint.lng,
      kayitTarihi: a.complaint.kayitTarihi.toISOString(),
    })),
    asfalt: asfalt.map((a) => ({
      id: a.asphaltRoad.id,
      ad: a.asphaltRoad.ad,
      durum: a.asphaltRoad.durum,
      koordinatlar: a.asphaltRoad.koordinatlar,
    })),
  };
}

export async function islerimSikayetDurumForUser(
  session: AppSession,
  input: {
    id: string;
    durum: SikayetDurum;
    cozumNotu?: string;
    cozumFotolari?: Array<string | { data: string; mime?: string }>;
  },
) {
  if (!SIKAYET_DURUMLAR.includes(input.durum)) throw new Error("Geçersiz durum");
  const personel = await oturumPersoneli(session.user.id);
  const atama = await prisma.complaintPersonnel.findUnique({
    where: {
      complaintId_personnelId: { complaintId: input.id, personnelId: personel.id },
    },
    include: { complaint: true },
  });
  if (!atama) throw new Error("Bu şikayet size atanmamış");
  const transition = canTransitionComplaint(
    atama.complaint.durum,
    input.durum,
    session.user.role,
  );
  if (!transition.ok) throw new Error(transition.error);

  const stored: string[] = [];
  const encoded: Array<string | { data: string; mime?: string }> = [];
  for (const item of input.cozumFotolari ?? []) {
    if (typeof item === "string") {
      const base = item.split("/").pop() ?? item;
      if (
        !item.startsWith("data:") &&
        /^[\w.-]+\.(jpe?g|png|webp)$/i.test(base)
      ) {
        stored.push(base);
        continue;
      }
    }
    encoded.push(item);
  }
  let cozumFotolari: string[] = stored;
  if (input.durum === "KAPATILDI" && encoded.length) {
    cozumFotolari = [...stored, ...(await saveComplaintPhotosFromBase64(encoded))];
  }

  try {
    await prisma.complaint.update({
      where: { id: input.id },
      data: {
        durum: input.durum,
        ...(input.durum === "KAPATILDI"
          ? {
              kapanisTarihi: new Date(),
              cozumNotu: input.cozumNotu,
              onaylayanId: session.user.id,
              ...(cozumFotolari.length > 0
                ? {
                    photos: {
                      create: cozumFotolari.map((url) => ({ url, tip: "COZUM" as const })),
                    },
                  }
                : {}),
            }
          : {}),
        events: {
          create: {
            userId: session.user.id,
            tip: "DURUM_DEGISTI",
            detay: {
              eski: atama.complaint.durum,
              yeni: input.durum,
              cozumNotu: input.cozumNotu,
              kaynak: "islerim",
              fotoAdet: cozumFotolari.length,
            },
          },
        },
      },
    });
  } catch (e) {
    await cleanupComplaintPhotoFiles(cozumFotolari);
    throw e;
  }

  const eski = atama.complaint;
  await auditKaydet(session, "ISLERIM_SIKAYET_DURUM", {
    varlik: "Complaint",
    varlikId: input.id,
    detay: { sikayetNo: eski.sikayetNo, eski: eski.durum, yeni: input.durum },
  });

  if (eski.departmentId && input.durum !== eski.durum) {
    const yoneticiler = await kullaniciIdleri(["DEPARTMENT_MANAGER"], eski.departmentId);
    await bildirimGonder(
      yoneticiler.filter((uid) => uid !== session.user.id),
      {
        tip: "GOREV",
        baslik: `${eski.sikayetNo} durumu güncellendi`,
        mesaj: `${personel.adSoyad}: ${eski.durum} → ${input.durum}`,
        href: `/sikayetler/${input.id}`,
      },
    );
  }
  return { ok: true };
}

export async function islerimAsfaltDurumForUser(
  session: AppSession,
  input: { id: string; durum: AsfaltDurum },
) {
  if (!ASFALT_DURUMLAR.includes(input.durum)) throw new Error("Geçersiz durum");
  const personel = await oturumPersoneli(session.user.id);
  const atama = await prisma.asphaltRoadPersonnel.findUnique({
    where: {
      asphaltRoadId_personnelId: { asphaltRoadId: input.id, personnelId: personel.id },
    },
    include: { asphaltRoad: { select: { ad: true, departmentId: true, durum: true } } },
  });
  if (!atama) throw new Error("Bu rota size atanmamış");
  const gecis = canTransitionAsfalt(
    atama.asphaltRoad.durum,
    input.durum,
    session.user.role,
  );
  if (!gecis.ok) throw new Error(gecis.error);
  await prisma.asphaltRoad.update({ where: { id: input.id }, data: { durum: input.durum } });
  await auditKaydet(session, "ISLERIM_ASFALT_DURUM", {
    varlik: "AsphaltRoad",
    varlikId: input.id,
    detay: {
      ad: atama.asphaltRoad.ad,
      eski: atama.asphaltRoad.durum,
      yeni: input.durum,
    },
  });
  if (atama.asphaltRoad.departmentId && input.durum !== atama.asphaltRoad.durum) {
    const yoneticiler = await kullaniciIdleri(
      ["DEPARTMENT_MANAGER"],
      atama.asphaltRoad.departmentId,
    );
    await bildirimGonder(
      yoneticiler.filter((uid) => uid !== session.user.id),
      {
        tip: "GOREV",
        baslik: `"${atama.asphaltRoad.ad}" rota durumu güncellendi`,
        mesaj: `${personel.adSoyad}: ${atama.asphaltRoad.durum} → ${input.durum}`,
        href: "/harita",
      },
    );
  }
  return { ok: true };
}
