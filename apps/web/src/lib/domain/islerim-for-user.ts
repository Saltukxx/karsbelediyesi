import { prisma } from "@kars/db";
import type { AsfaltDurum, SikayetDurum } from "@kars/db";
import { canTransitionAsfalt } from "@/lib/domain/asfalt-status";
import { canTransitionComplaint } from "@/lib/domain/complaint-status";
import { auditKaydet } from "@/lib/audit";
import { bildirimGonder, kullaniciIdleri } from "@/lib/notify";
import {
  cleanupComplaintPhotoFiles,
  saveComplaintPhotosFromBase64,
} from "@/lib/complaint-photos";
import type { SessionUser } from "@/lib/authz";

const SIKAYET_DURUMLAR: SikayetDurum[] = [
  "ACIK",
  "DEVAM_EDIYOR",
  "KAPATILDI",
  "IPTAL",
];
const ASFALT_DURUMLAR: AsfaltDurum[] = [
  "PLANLANDI",
  "DEVAM_EDIYOR",
  "TAMAMLANDI",
];

async function oturumPersoneli(userId: string) {
  const personel = await prisma.personnel.findFirst({
    where: { userId },
    select: { id: true, adSoyad: true },
  });
  if (!personel) throw new Error("Hesabınıza bağlı personel kaydı bulunamadı");
  return personel;
}

export async function islerimGetirForUser(user: SessionUser) {
  const [personel, aracGorevleri] = await Promise.all([
    prisma.personnel.findFirst({
      where: { userId: user.id },
      select: { id: true, adSoyad: true, department: { select: { name: true } } },
    }),
    prisma.vehicleTask.findMany({
      where: { driverId: user.id },
      orderBy: [{ durum: "asc" }, { talepTarihi: "desc" }],
      take: 50,
      select: {
        id: true,
        gorevNo: true,
        durum: true,
        gorevYeri: true,
        gorevTanimi: true,
        kmSayacCikis: true,
        kmSayacGiris: true,
        vehicle: { select: { id: true, plaka: true, sayacDeger: true } },
      },
    }),
  ]);

  const [sikayetler, asfalt] = personel
    ? await Promise.all([
        prisma.complaintPersonnel.findMany({
          where: { personnelId: personel.id },
          include: {
            complaint: {
              include: {
                complaintType: { select: { id: true, name: true } },
                neighborhood: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { complaint: { kayitTarihi: "desc" } },
          take: 50,
        }),
        prisma.asphaltRoadPersonnel.findMany({
          where: { personnelId: personel.id },
          include: {
            asphaltRoad: {
              select: {
                id: true,
                ad: true,
                durum: true,
                koordinatlar: true,
                departmentId: true,
              },
            },
          },
        }),
      ])
    : [[], []];

  return {
    personel: personel
      ? { id: personel.id, adSoyad: personel.adSoyad, mudurluk: personel.department?.name }
      : null,
    sikayetler: sikayetler.map((a) => ({
      id: a.complaint.id,
      sikayetNo: a.complaint.sikayetNo,
      durum: a.complaint.durum,
      oncelik: a.complaint.oncelik,
      arayanKisi: a.complaint.arayanKisi,
      telefon: a.complaint.telefon,
      aciklama: a.complaint.aciklama,
      acikAdres: a.complaint.acikAdres,
      lat: a.complaint.lat,
      lng: a.complaint.lng,
      complaintType: a.complaint.complaintType,
      neighborhood: a.complaint.neighborhood,
      department: a.complaint.department,
    })),
    asfalt: asfalt.map((a) => ({
      id: a.asphaltRoad.id,
      ad: a.asphaltRoad.ad,
      durum: a.asphaltRoad.durum,
      koordinatlar: a.asphaltRoad.koordinatlar,
    })),
    gorevler: aracGorevleri,
  };
}

export async function islerimSikayetDurumForUser(
  user: SessionUser,
  input: {
    id: string;
    durum: SikayetDurum;
    cozumNotu?: string;
    cozumFotolari?: Array<string | { data: string; mime?: string }>;
  },
) {
  if (!SIKAYET_DURUMLAR.includes(input.durum)) throw new Error("Geçersiz durum");
  const personel = await oturumPersoneli(user.id);
  const atama = await prisma.complaintPersonnel.findUnique({
    where: {
      complaintId_personnelId: { complaintId: input.id, personnelId: personel.id },
    },
    include: { complaint: true },
  });
  if (!atama) throw new Error("Bu şikayet size atanmamış");

  const eski = atama.complaint;
  const transition = canTransitionComplaint(eski.durum, input.durum, user.role);
  if (!transition.ok) throw new Error(transition.error);

  let cozumFotolari: string[] = [];
  if (input.durum === "KAPATILDI" && input.cozumFotolari?.length) {
    cozumFotolari = await saveComplaintPhotosFromBase64(input.cozumFotolari);
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
              onaylayanId: user.id,
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
            userId: user.id,
            tip: "DURUM_DEGISTI",
            detay: {
              eski: eski.durum,
              yeni: input.durum,
              cozumNotu: input.cozumNotu,
              kaynak: "api-v1",
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

  await auditKaydet({ user }, "ISLERIM_SIKAYET_DURUM", {
    varlik: "Complaint",
    varlikId: input.id,
    detay: { sikayetNo: eski.sikayetNo, eski: eski.durum, yeni: input.durum },
  });

  if (eski.departmentId && input.durum !== eski.durum) {
    const yoneticiler = await kullaniciIdleri(["DEPARTMENT_MANAGER"], eski.departmentId);
    await bildirimGonder(
      yoneticiler.filter((uid) => uid !== user.id),
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
  user: SessionUser,
  input: { id: string; durum: AsfaltDurum },
) {
  if (!ASFALT_DURUMLAR.includes(input.durum)) throw new Error("Geçersiz durum");
  const personel = await oturumPersoneli(user.id);
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
    user.role,
  );
  if (!gecis.ok) throw new Error(gecis.error);

  await prisma.asphaltRoad.update({ where: { id: input.id }, data: { durum: input.durum } });
  await auditKaydet({ user }, "ISLERIM_ASFALT_DURUM", {
    varlik: "AsphaltRoad",
    varlikId: input.id,
    detay: { ad: atama.asphaltRoad.ad, eski: atama.asphaltRoad.durum, yeni: input.durum },
  });
  return { ok: true };
}
