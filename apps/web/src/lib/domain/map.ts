import { prisma } from "@kars/db";
import type { AsfaltDurum, HazardDurum, HazardTip } from "@kars/db";
import { ACTION_ROLES, departmentScope, type AppSession } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";
import { bildirimGonder, kullaniciIdleri } from "@/lib/notify";
import { KONUM_TAZELIK_MS } from "@/lib/location";
import { parseKoordinatlar } from "@/lib/v1-handler";
import { saveHazardPhoto } from "@/lib/hazard-photos";

const ASFALT_DURUMLAR: AsfaltDurum[] = ["PLANLANDI", "DEVAM_EDIYOR", "TAMAMLANDI"];
const HAZARD_TIPLER: HazardTip[] = ["CUKUR", "ENGEL", "DIGER"];
const HAZARD_DURUMLAR: HazardDurum[] = ["ACIK", "GIDERILDI"];

function assertAsfaltDeptWrite(session: AppSession, departmentId: string | null | undefined) {
  if (session.user.role !== "DEPARTMENT_MANAGER") return;
  if (!session.user.departmentId) throw new Error("Yetkisiz");
  if (departmentId !== session.user.departmentId) throw new Error("Yetkisiz");
}

export async function mapVerisiForUser(session: AppSession) {
  const canEdit = ACTION_ROLES.harita.includes(session.user.role);
  const dept = departmentScope(session);
  const [roadRows, hazardRows, complaintRows, vehicleRows] = await Promise.all([
    prisma.asphaltRoad.findMany({
      where: dept,
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { name: true } },
        department: { select: { name: true } },
        personel: { include: { personnel: { select: { id: true, adSoyad: true } } } },
      },
    }),
    prisma.roadHazard.findMany({
      where: dept,
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { name: true } }, photos: { select: { id: true } } },
    }),
    prisma.complaint.findMany({
      where: { lat: { not: null }, lng: { not: null }, ...dept },
      select: {
        id: true,
        sikayetNo: true,
        durum: true,
        lat: true,
        lng: true,
        aciklama: true,
      },
    }),
    prisma.vehicle.findMany({
      where: {
        sonKonumLat: { not: null },
        sonKonumLng: { not: null },
        sonKonumZamani: { gte: new Date(Date.now() - KONUM_TAZELIK_MS) },
        ...dept,
      },
      select: {
        id: true,
        plaka: true,
        sonKonumLat: true,
        sonKonumLng: true,
        sonKonumZamani: true,
        vehicleType: { select: { name: true } },
      },
    }),
  ]);
  return {
    canEdit,
    roads: roadRows.map((r) => ({
      id: r.id,
      ad: r.ad,
      durum: r.durum,
      koordinatlar: r.koordinatlar,
      departmentId: r.departmentId,
      department: r.department?.name ?? null,
      personel: r.personel.map((p) => p.personnel),
      createdBy: r.createdBy?.name ?? null,
    })),
    hazards: hazardRows.map((h) => ({
      id: h.id,
      tip: h.tip,
      durum: h.durum,
      lat: h.lat,
      lng: h.lng,
      aciklama: h.aciklama,
      photoIds: h.photos.map((p) => p.id),
      createdBy: h.createdBy?.name ?? null,
    })),
    complaints: complaintRows,
    vehicles: vehicleRows.map((v) => ({
      id: v.id,
      plaka: v.plaka,
      lat: v.sonKonumLat,
      lng: v.sonKonumLng,
      zaman: v.sonKonumZamani?.toISOString() ?? null,
      cins: v.vehicleType?.name ?? null,
    })),
  };
}

export async function asfaltYolKaydetForUser(
  session: AppSession,
  input: {
    ad: string;
    koordinatlar: unknown;
    departmentId?: string;
    durum?: AsfaltDurum;
    notlar?: string;
    personnelIds?: string[];
  },
) {
  const koordinatlar = parseKoordinatlar(input.koordinatlar);
  const departmentId =
    session.user.role === "DEPARTMENT_MANAGER"
      ? session.user.departmentId
      : input.departmentId;
  assertAsfaltDeptWrite(session, departmentId);
  const durum = ASFALT_DURUMLAR.includes(input.durum as AsfaltDurum)
    ? (input.durum as AsfaltDurum)
    : "PLANLANDI";
  const road = await prisma.asphaltRoad.create({
    data: {
      ad: input.ad.trim(),
      koordinatlar,
      departmentId,
      durum,
      notlar: input.notlar,
      createdById: session.user.id,
      ...(input.personnelIds?.length
        ? {
            personel: {
              create: input.personnelIds.map((personnelId) => ({ personnelId })),
            },
          }
        : {}),
    },
  });
  await auditKaydet(session, "ASFALT_YOL_OLUSTUR", {
    varlik: "AsphaltRoad",
    varlikId: road.id,
    detay: { ad: road.ad },
  });
  if (departmentId) {
    const yoneticiler = await kullaniciIdleri(["DEPARTMENT_MANAGER"], departmentId);
    await bildirimGonder(
      yoneticiler.filter((uid) => uid !== session.user.id),
      {
        tip: "ATAMA",
        baslik: "Asfalt rotası müdürlüğünüze atandı",
        mesaj: `${session.user.name} "${road.ad}" rotasını müdürlüğünüze atadı.`,
        href: "/harita",
      },
    );
  }
  return road;
}

export async function asfaltYolGuncelleForUser(
  session: AppSession,
  input: {
    id: string;
    ad: string;
    koordinatlar: unknown;
    departmentId?: string;
    durum?: AsfaltDurum;
    notlar?: string;
  },
) {
  const mevcut = await prisma.asphaltRoad.findUnique({ where: { id: input.id } });
  if (!mevcut) throw new Error("Rota bulunamadı");
  assertAsfaltDeptWrite(session, mevcut.departmentId);
  const koordinatlar = parseKoordinatlar(input.koordinatlar);
  const durum = ASFALT_DURUMLAR.includes(input.durum as AsfaltDurum)
    ? (input.durum as AsfaltDurum)
    : mevcut.durum;
  await prisma.asphaltRoad.update({
    where: { id: input.id },
    data: {
      ad: input.ad.trim(),
      koordinatlar,
      departmentId: input.departmentId ?? mevcut.departmentId,
      durum,
      notlar: input.notlar ?? null,
    },
  });
  await auditKaydet(session, "ASFALT_YOL_GUNCELLE", {
    varlik: "AsphaltRoad",
    varlikId: input.id,
  });
  return { ok: true };
}

export async function asfaltYolSilForUser(session: AppSession, id: string) {
  const mevcut = await prisma.asphaltRoad.findUnique({ where: { id } });
  if (!mevcut) throw new Error("Rota bulunamadı");
  assertAsfaltDeptWrite(session, mevcut.departmentId);
  await prisma.asphaltRoad.delete({ where: { id } });
  await auditKaydet(session, "ASFALT_YOL_SIL", { varlik: "AsphaltRoad", varlikId: id });
  return { ok: true };
}

export async function engelKaydetForUser(
  session: AppSession,
  input: {
    tip?: HazardTip;
    lat: number;
    lng: number;
    aciklama?: string;
    fotolar?: Array<{ data: string; mime?: string }>;
  },
) {
  const tip = HAZARD_TIPLER.includes(input.tip as HazardTip)
    ? (input.tip as HazardTip)
    : "ENGEL";
  const hazard = await prisma.roadHazard.create({
    data: {
      tip,
      lat: input.lat,
      lng: input.lng,
      aciklama: input.aciklama,
      durum: "ACIK",
      createdById: session.user.id,
      departmentId: session.user.departmentId,
    },
  });
  if (input.fotolar?.length) {
    for (const foto of input.fotolar) {
      const raw = foto.data.replace(/^data:[^;]+;base64,/, "");
      const buf = Buffer.from(raw, "base64");
      const mime = foto.mime ?? "image/jpeg";
      const file = new File([buf], "engel.jpg", { type: mime });
      const url = await saveHazardPhoto(file);
      await prisma.roadHazardPhoto.create({
        data: { hazardId: hazard.id, url },
      });
    }
  }
  await auditKaydet(session, "ENGEL_OLUSTUR", {
    varlik: "RoadHazard",
    varlikId: hazard.id,
  });
  return hazard;
}

export async function engelDurumGuncelleForUser(
  session: AppSession,
  input: { id: string; durum: HazardDurum },
) {
  if (!HAZARD_DURUMLAR.includes(input.durum)) throw new Error("Geçersiz durum");
  await prisma.roadHazard.update({
    where: { id: input.id },
    data: { durum: input.durum },
  });
  await auditKaydet(session, "ENGEL_DURUM", {
    varlik: "RoadHazard",
    varlikId: input.id,
    detay: { durum: input.durum },
  });
  return { ok: true };
}

export async function engelSilForUser(session: AppSession, id: string) {
  await prisma.roadHazard.delete({ where: { id } });
  await auditKaydet(session, "ENGEL_SIL", { varlik: "RoadHazard", varlikId: id });
  return { ok: true };
}
