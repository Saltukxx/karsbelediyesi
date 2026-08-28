import { prisma } from "@kars/db";
import type { AsfaltDurum, DispatchTip, HazardDurum, HazardTip, KisOperasyonTip, KisRotaTip, TemizlikOperasyonTip } from "@kars/db";
import { ACTION_ROLES, assertRole, type SessionUser } from "@/lib/authz";
import { auditKaydet } from "@/lib/audit";
import { parseKoordinatlar } from "@/lib/domain/coords";
import {
  adaylariSkorla,
  aracOner,
  dispatchAta,
  dispatchReddet,
} from "@/lib/dispatch";
import { KONUM_TAZELIK_MS } from "@/lib/location";

export async function haritaVerisiGetir() {
  const [yollar, engeller, sikayetler, araclar] = await Promise.all([
    prisma.asphaltRoad.findMany({
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: {
        id: true,
        ad: true,
        durum: true,
        koordinatlar: true,
        departmentId: true,
      },
    }),
    prisma.roadHazard.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        tip: true,
        lat: true,
        lng: true,
        aciklama: true,
        durum: true,
        photos: { select: { id: true }, take: 3 },
      },
    }),
    prisma.complaint.findMany({
      where: { lat: { not: null }, lng: { not: null }, durum: { in: ["ACIK", "DEVAM_EDIYOR"] } },
      take: 200,
      select: {
        id: true,
        sikayetNo: true,
        oncelik: true,
        durum: true,
        lat: true,
        lng: true,
        arayanKisi: true,
      },
    }),
    prisma.vehicle.findMany({
      where: {
        envanterDurumu: { not: "HURDAYA_AYRILDI" },
        sonKonumLat: { not: null },
        sonKonumLng: { not: null },
      },
      select: {
        id: true,
        plaka: true,
        sonKonumLat: true,
        sonKonumLng: true,
        sonKonumZamani: true,
      },
    }),
  ]);

  const now = Date.now();
  return {
    asfalt: yollar,
    engeller: engeller.map((e) => ({
      ...e,
      photoIds: e.photos.map((p) => p.id),
      photos: undefined,
    })),
    sikayetler,
    araclar: araclar
      .map((a) => {
        if (a.sonKonumLat == null || a.sonKonumLng == null || !a.sonKonumZamani) return null;
        return {
          id: a.id,
          plaka: a.plaka,
          lat: a.sonKonumLat,
          lng: a.sonKonumLng,
          taze: now - a.sonKonumZamani.getTime() < KONUM_TAZELIK_MS,
        };
      })
      .filter(Boolean),
  };
}

export async function asfaltYolKaydetForUser(
  user: SessionUser,
  input: { ad: string; koordinatlar: unknown; durum?: AsfaltDurum; departmentId?: string; notlar?: string },
) {
  assertRole(user, ACTION_ROLES.harita);
  const ad = input.ad.trim();
  if (!ad) throw new Error("Ad zorunlu");
  const koordinatlar = parseKoordinatlar(input.koordinatlar);
  const departmentId =
    user.role === "DEPARTMENT_MANAGER" ? user.departmentId : input.departmentId;
  const row = await prisma.asphaltRoad.create({
    data: {
      ad,
      koordinatlar,
      durum: input.durum ?? "PLANLANDI",
      departmentId,
      notlar: input.notlar,
      createdById: user.id,
    },
  });
  await auditKaydet({ user }, "ASFALT_YOL_OLUSTUR", { varlik: "AsphaltRoad", varlikId: row.id });
  return row;
}

export async function engelKaydetForUser(
  user: SessionUser,
  input: { lat: number; lng: number; tip?: HazardTip; aciklama?: string },
) {
  assertRole(user, ACTION_ROLES.harita);
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    throw new Error("Konum zorunlu");
  }
  const row = await prisma.roadHazard.create({
    data: {
      lat: input.lat,
      lng: input.lng,
      tip: input.tip ?? "CUKUR",
      aciklama: input.aciklama,
      departmentId: user.departmentId,
      createdById: user.id,
    },
  });
  await auditKaydet({ user }, "ENGEL_OLUSTUR", { varlik: "RoadHazard", varlikId: row.id });
  return row;
}

export async function engelDurumForUser(
  user: SessionUser,
  input: { id: string; durum: HazardDurum },
) {
  assertRole(user, ACTION_ROLES.harita);
  await prisma.roadHazard.update({ where: { id: input.id }, data: { durum: input.durum } });
  return { ok: true };
}

async function rotaList(kind: "kis" | "cop" | "temizlik") {
  if (kind === "kis") {
    return prisma.winterRoute.findMany({
      where: { aktif: true },
      orderBy: { oncelik: "asc" },
      select: { id: true, ad: true, koordinatlar: true, tip: true, oncelik: true, notlar: true },
    });
  }
  if (kind === "cop") {
    return prisma.wasteRoute.findMany({
      where: { aktif: true },
      orderBy: { oncelik: "asc" },
      select: { id: true, ad: true, koordinatlar: true, oncelik: true, gunler: true, notlar: true },
    });
  }
  return prisma.cleaningRoute.findMany({
    where: { aktif: true },
    orderBy: { oncelik: "asc" },
    select: { id: true, ad: true, koordinatlar: true, oncelik: true, notlar: true },
  });
}

export async function sahaRotalariGetir(kind: "kis" | "cop" | "temizlik") {
  return rotaList(kind);
}

export async function kisRotaKaydetForUser(
  user: SessionUser,
  input: { ad: string; koordinatlar: unknown; tip?: KisRotaTip; oncelik?: number; notlar?: string },
) {
  assertRole(user, ACTION_ROLES.kis);
  const ad = input.ad.trim();
  if (!ad) throw new Error("Rota adı gerekli");
  const row = await prisma.winterRoute.create({
    data: {
      ad,
      koordinatlar: parseKoordinatlar(input.koordinatlar),
      tip: input.tip ?? "KARMA",
      oncelik: Math.min(Math.max(Math.round(input.oncelik ?? 2), 1), 3),
      notlar: input.notlar,
      createdById: user.id,
    },
  });
  await auditKaydet({ user }, "KIS_ROTA_OLUSTUR", { varlik: "WinterRoute", varlikId: row.id });
  return row;
}

export async function copRotaKaydetForUser(
  user: SessionUser,
  input: { ad: string; koordinatlar: unknown; gunler?: number[]; oncelik?: number; notlar?: string },
) {
  assertRole(user, ACTION_ROLES.cop);
  const ad = input.ad.trim();
  if (!ad) throw new Error("Rota adı gerekli");
  const row = await prisma.wasteRoute.create({
    data: {
      ad,
      koordinatlar: parseKoordinatlar(input.koordinatlar),
      gunler: input.gunler ?? [1, 2, 3, 4, 5],
      oncelik: Math.min(Math.max(Math.round(input.oncelik ?? 2), 1), 3),
      notlar: input.notlar,
      createdById: user.id,
    },
  });
  await auditKaydet({ user }, "COP_ROTA_OLUSTUR", { varlik: "WasteRoute", varlikId: row.id });
  return row;
}

export async function temizlikRotaKaydetForUser(
  user: SessionUser,
  input: { ad: string; koordinatlar: unknown; oncelik?: number; notlar?: string },
) {
  assertRole(user, ACTION_ROLES.temizlik);
  const ad = input.ad.trim();
  if (!ad) throw new Error("Rota adı gerekli");
  const row = await prisma.cleaningRoute.create({
    data: {
      ad,
      koordinatlar: parseKoordinatlar(input.koordinatlar),
      oncelik: Math.min(Math.max(Math.round(input.oncelik ?? 2), 1), 3),
      notlar: input.notlar,
      createdById: user.id,
    },
  });
  await auditKaydet({ user }, "TEMIZLIK_ROTA_OLUSTUR", {
    varlik: "CleaningRoute",
    varlikId: row.id,
  });
  return row;
}

export async function kisOperasyonKaydetForUser(
  user: SessionUser,
  input: { routeId: string; tip?: KisOperasyonTip; vehicleId?: string; notlar?: string },
) {
  assertRole(user, ACTION_ROLES.kis);
  if (!input.routeId) throw new Error("Rota zorunlu");
  const row = await prisma.winterOperation.create({
    data: {
      routeId: input.routeId,
      tip: input.tip ?? "KARMA",
      vehicleId: input.vehicleId,
      driverId: user.id,
      baslangic: new Date(),
      notlar: input.notlar,
      createdById: user.id,
    },
  });
  await auditKaydet({ user }, "KIS_OPERASYON", { varlik: "WinterOperation", varlikId: row.id });
  return row;
}

export async function copToplamaKaydetForUser(
  user: SessionUser,
  input: { routeId: string; vehicleId?: string; notlar?: string },
) {
  assertRole(user, ACTION_ROLES.cop);
  if (!input.routeId) throw new Error("Rota zorunlu");
  const row = await prisma.wasteCollection.create({
    data: {
      routeId: input.routeId,
      vehicleId: input.vehicleId,
      driverId: user.id,
      baslangic: new Date(),
      notlar: input.notlar,
      createdById: user.id,
    },
  });
  await auditKaydet({ user }, "COP_TOPLAMA", { varlik: "WasteCollection", varlikId: row.id });
  return row;
}

export async function temizlikOperasyonKaydetForUser(
  user: SessionUser,
  input: { routeId: string; tip?: TemizlikOperasyonTip; vehicleId?: string; notlar?: string },
) {
  assertRole(user, ACTION_ROLES.temizlik);
  if (!input.routeId) throw new Error("Rota zorunlu");
  const row = await prisma.cleaningOperation.create({
    data: {
      routeId: input.routeId,
      tip: input.tip ?? "SUPURME",
      vehicleId: input.vehicleId,
      driverId: user.id,
      baslangic: new Date(),
      notlar: input.notlar,
      createdById: user.id,
    },
  });
  await auditKaydet({ user }, "TEMIZLIK_OPERASYON", {
    varlik: "CleaningOperation",
    varlikId: row.id,
  });
  return row;
}

export async function dispatchAdaylariForUser(
  user: SessionUser,
  tip: DispatchTip,
  routeId: string,
) {
  assertRole(user, ACTION_ROLES.dispatch);
  const { routeAd, adaylar } = await adaylariSkorla(tip, routeId);
  return {
    routeAd,
    adaylar: adaylar.map((a) => ({
      vehicleId: a.vehicleId,
      plaka: a.plaka,
      tip: a.tip,
      sureDk: a.sureDk,
      mesafeKm: a.mesafeKm,
      tahmini: a.tahmini,
      skor: a.skor,
      etiketler: a.etiketler,
      bayat: a.bayat,
    })),
  };
}

export async function dispatchAtaForUser(
  user: SessionUser,
  input: { tip: DispatchTip; routeId: string; vehicleId: string },
) {
  assertRole(user, ACTION_ROLES.dispatch);
  const oneri = await aracOner(input.tip, input.routeId, input.vehicleId);
  if (!oneri) throw new Error("Seçilen araç artık uygun değil — listeyi yenileyin");
  const { gorevNo, taskId } = await dispatchAta(oneri.jobId, user);
  await auditKaydet({ user }, "DISPATCH_ATA", {
    varlik: "VehicleTask",
    varlikId: taskId,
    detay: { gorevNo, jobId: oneri.jobId, plaka: oneri.plaka },
  });
  return { gorevNo, taskId };
}

export async function dispatchReddetForUser(user: SessionUser, jobId: string) {
  assertRole(user, ACTION_ROLES.dispatch);
  if (!jobId) throw new Error("Öneri bulunamadı");
  await dispatchReddet(jobId);
  await auditKaydet({ user }, "DISPATCH_REDDET", { varlik: "DispatchJob", varlikId: jobId });
  return { ok: true };
}
