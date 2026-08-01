import { z } from "zod";
import { nextTaskSerial, prisma, withSerialRetry } from "@kars/db";
import { gorevSuresiSaatTarihli, kmFarki } from "@kars/shared";
import {
  canAccessTask,
  gorevOlusturmaKapsami,
  loadTaskForAccess,
  toAccessUser,
} from "@/lib/access";
import { iso, num } from "@/lib/api/serialize";
import type { DuraklamaDto, SapmaDto, VeriBosluguDto } from "@/lib/api/track-dto";
import { auditKaydet } from "@/lib/audit";
import { ACTION_ROLES } from "@/lib/authz";
import { takipZamanCizelgesi } from "@/lib/domain/takip-cizelge";
import { canTransitionTask, validateKmPair } from "@/lib/domain/task-status";
import { bildirimGonder, kullaniciIdleri } from "@/lib/notify";
import {
  dispatchRotasi,
  gorevIziAnalizDene,
  gorevIziAnalizEt,
} from "@/lib/route-analysis";
import {
  opsiyonelMetin as bosBoslukTemiz,
  rolGerekli,
  sayiAlani,
  ServiceError,
  tarihAlani,
  type ServiceActor,
} from "@/lib/services/base";

export const gorevInputSchema = z.object({
  vehicleId: z.string().trim().min(1, "Araç zorunlu"),
  talepEdenDepartmentId: bosBoslukTemiz,
  driverId: bosBoslukTemiz,
  gorevYeri: bosBoslukTemiz,
  gorevTanimi: bosBoslukTemiz,
  cikisTarihi: tarihAlani().optional(),
  girisTarihi: tarihAlani().optional(),
  kmSayacCikis: sayiAlani(z.number().nonnegative()).optional(),
  kmSayacGiris: sayiAlani(z.number().nonnegative()).optional(),
  onaylayanId: bosBoslukTemiz,
  durum: z
    .enum(["PLANLANDI", "DEVAM_EDIYOR", "TAMAMLANDI", "IPTAL_EDILDI"])
    .default("PLANLANDI"),
  not: bosBoslukTemiz,
  maliyet: sayiAlani(z.number().nonnegative()).optional(),
});

export type GorevInput = z.input<typeof gorevInputSchema>;

/**
 * Görev oluşturma (Excel Görev Formu satırı).
 * Görev No otomatik: GRV-2026-0001. Araç seçilince şoför zimmetten önerilir.
 * Durum "Devam Ediyor" ise araç GOREVDE yapılır (Excel Araç Havuzu durumu).
 */
export async function gorevOlustur(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ["ADMIN", "DEPARTMENT_MANAGER", "APPROVER"]);
  const data = gorevInputSchema.parse(input);

  const kmCheck = validateKmPair(data.kmSayacCikis, data.kmSayacGiris);
  if (!kmCheck.ok) throw new ServiceError(kmCheck.error);

  const kapsam = await gorevOlusturmaKapsami(toAccessUser(actor.user), {
    vehicleId: data.vehicleId,
    talepEdenDepartmentId: data.talepEdenDepartmentId ?? null,
    driverId: data.driverId ?? null,
  });
  if (!kapsam.ok) throw new ServiceError(kapsam.error, 403);

  const arac = await prisma.vehicle.findUniqueOrThrow({
    where: { id: data.vehicleId },
    select: { id: true, plaka: true },
  });

  const created = await withSerialRetry(prisma, async (tx) => {
    const { yil, sira, gorevNo } = await nextTaskSerial(tx);

    const gorev = await tx.vehicleTask.create({
      data: {
        gorevNo,
        yil,
        sira,
        vehicleId: data.vehicleId,
        talepEdenDepartmentId: kapsam.talepEdenDepartmentId ?? undefined,
        gorevYeri: data.gorevYeri,
        gorevTanimi: data.gorevTanimi,
        cikisTarihi: data.cikisTarihi,
        girisTarihi: data.girisTarihi,
        sureSaat:
          data.cikisTarihi && data.girisTarihi
            ? gorevSuresiSaatTarihli(data.cikisTarihi, data.girisTarihi)
            : undefined,
        driverId: kapsam.driverId ?? undefined,
        kmSayacCikis: data.kmSayacCikis,
        kmSayacGiris: data.kmSayacGiris,
        kmFarki:
          data.kmSayacCikis != null && data.kmSayacGiris != null
            ? kmFarki(data.kmSayacCikis, data.kmSayacGiris)
            : undefined,
        onaylayanId: data.onaylayanId,
        durum: data.durum,
        not: data.not,
        maliyet: data.maliyet,
      },
    });

    if (data.durum === "DEVAM_EDIYOR") {
      await tx.vehicle.update({
        where: { id: data.vehicleId },
        data: {
          operasyonDurumu: "GOREVDE",
          sonCikisTarihi: data.cikisTarihi ?? new Date(),
        },
      });
    }

    return gorev;
  });

  await auditKaydet(actor, "GOREV_OLUSTUR", {
    varlik: "VehicleTask",
    varlikId: created.id,
    detay: { gorevNo: created.gorevNo, plaka: arac.plaka, durum: data.durum },
  });

  if (created.driverId && created.driverId !== actor.user.id) {
    await bildirimGonder([created.driverId], {
      tip: "GOREV",
      baslik: `Yeni görev: ${created.gorevNo}`,
      mesaj: `${arac.plaka} plakalı araç için görev oluşturuldu.`,
      href: "/gorevler",
    });
  }

  return created;
}

export const gorevBaslatInputSchema = z.object({
  kmSayacCikis: sayiAlani(z.number().nonnegative()).optional(),
});

export type GorevBaslatInput = z.input<typeof gorevBaslatInputSchema>;

/** Görevi başlat: çıkış zamanı yazılır, araç GOREVDE olur */
export async function gorevBaslat(
  actor: ServiceActor,
  id: string,
  input: unknown = {},
) {
  rolGerekli(actor, ACTION_ROLES.tasks);
  const data = gorevBaslatInputSchema.parse(input);
  const gorev = await gorevErisim(actor, id);

  const transition = canTransitionTask(gorev.durum, "DEVAM_EDIYOR");
  if (!transition.ok) throw new ServiceError(transition.error, 409);

  const cikis = new Date();

  const guncel = await prisma.$transaction(async (tx) => {
    const updated = await tx.vehicleTask.update({
      where: { id },
      data: {
        cikisTarihi: gorev.cikisTarihi ?? cikis,
        kmSayacCikis: data.kmSayacCikis ?? gorev.kmSayacCikis,
        durum: "DEVAM_EDIYOR",
      },
    });
    await tx.vehicle.update({
      where: { id: gorev.vehicleId },
      data: { operasyonDurumu: "GOREVDE", sonCikisTarihi: cikis },
    });
    return updated;
  });

  await auditKaydet(actor, "GOREV_BASLAT", {
    varlik: "VehicleTask",
    varlikId: id,
    detay: { gorevNo: gorev.gorevNo },
  });

  return guncel;
}

export const gorevKapatInputSchema = z.object({
  girisTarihi: tarihAlani().optional(),
  kmSayacGiris: sayiAlani(z.number().nonnegative()).optional(),
  durum: z.enum(["TAMAMLANDI", "IPTAL_EDILDI"]).default("TAMAMLANDI"),
});

export type GorevKapatInput = z.input<typeof gorevKapatInputSchema>;

/** Görev kapatma: giriş zamanı + KM girilir; süre ve KM farkı hesaplanır, araç MUSAIT olur */
export async function gorevKapat(
  actor: ServiceActor,
  id: string,
  input: unknown = {},
) {
  rolGerekli(actor, ACTION_ROLES.tasks);
  const data = gorevKapatInputSchema.parse(input);
  const gorev = await gorevErisim(actor, id);

  const transition = canTransitionTask(gorev.durum, data.durum);
  if (!transition.ok) throw new ServiceError(transition.error, 409);

  const kmCheck = validateKmPair(gorev.kmSayacCikis, data.kmSayacGiris);
  if (!kmCheck.ok) throw new ServiceError(kmCheck.error);

  const giris = data.girisTarihi ?? new Date();

  const guncel = await prisma.$transaction(async (tx) => {
    const updated = await tx.vehicleTask.update({
      where: { id },
      data: {
        girisTarihi: giris,
        sureSaat: gorev.cikisTarihi
          ? gorevSuresiSaatTarihli(gorev.cikisTarihi, giris)
          : gorev.sureSaat,
        kmSayacGiris: data.kmSayacGiris ?? gorev.kmSayacGiris,
        kmFarki:
          gorev.kmSayacCikis != null && data.kmSayacGiris != null
            ? kmFarki(gorev.kmSayacCikis, data.kmSayacGiris)
            : gorev.kmFarki,
        durum: data.durum,
      },
    });
    // Araç başka aktif göreve bağlıysa müsait yapılmaz
    const otherActive = await tx.vehicleTask.count({
      where: {
        vehicleId: gorev.vehicleId,
        durum: "DEVAM_EDIYOR",
        id: { not: id },
      },
    });
    if (otherActive === 0) {
      await tx.vehicle.update({
        where: { id: gorev.vehicleId },
        data: {
          operasyonDurumu: "MUSAIT",
          sonGirisTarihi: giris,
          ...(data.kmSayacGiris != null ? { sayacDeger: data.kmSayacGiris } : {}),
        },
      });
    }
    return updated;
  });

  await gorevIziAnalizDene(id);

  await auditKaydet(actor, "GOREV_KAPAT", {
    varlik: "VehicleTask",
    varlikId: id,
    detay: { gorevNo: gorev.gorevNo, durum: data.durum },
  });

  const onaylayanlar = await kullaniciIdleri(["APPROVER"]);
  await bildirimGonder(
    onaylayanlar.filter((uid) => uid !== actor.user.id),
    {
      tip: "GOREV",
      baslik: `Görev kapatıldı: ${gorev.gorevNo}`,
      mesaj: `${actor.user.name} görevi ${
        data.durum === "TAMAMLANDI" ? "tamamlandı" : "iptal"
      } olarak kapattı.`,
      href: "/gorevler",
    },
  );

  return guncel;
}

/**
 * Rota izi analizini yeniden çalıştırır (planlanan vs gerçek iz raporu).
 * Kullanıcının açık isteği olduğu için hata yutulmaz: dispatch rotasına bağlı
 * olmayan görevde açıklayıcı hata döner.
 */
export async function gorevYenidenAnalizEt(actor: ServiceActor, id: string) {
  rolGerekli(actor, ACTION_ROLES.tasks);
  const gorev = await gorevErisim(actor, id);

  const sonuc = await gorevIziAnalizEt(id);
  if (!sonuc) {
    throw new ServiceError(
      "Bu görev bir dispatch rotasına bağlı değil — analiz yapılamaz",
      409,
    );
  }

  await auditKaydet(actor, "GOREV_TAKIP_ANALIZ", {
    varlik: "VehicleTask",
    varlikId: id,
    detay: { gorevNo: gorev.gorevNo, sonuc: sonuc.sonuc },
  });

  return sonuc;
}

// ── Okuma ────────────────────────────────────────────────────────────────────

/** Görev kartı: tam alan seti + rota takip özeti (varsa). */
export async function gorevDetay(actor: ServiceActor, id: string) {
  await gorevErisim(actor, id);

  const gorev = await prisma.vehicleTask.findUniqueOrThrow({
    where: { id },
    include: {
      vehicle: {
        select: {
          id: true,
          plaka: true,
          ad: true,
          departmentId: true,
          vehicleType: { select: { name: true } },
        },
      },
      driver: { select: { id: true, name: true, phone: true } },
      talepEdenDepartment: { select: { id: true, name: true } },
      onaylayan: { select: { id: true, name: true } },
      dispatchJob: { select: { id: true, tip: true, routeAd: true } },
      trackAnalysis: { select: { sonuc: true, uyumYuzde: true, kapsamaYuzde: true } },
    },
  });

  return {
    id: gorev.id,
    gorevNo: gorev.gorevNo,
    durum: gorev.durum,
    talepTarihi: iso(gorev.talepTarihi),
    gorevYeri: gorev.gorevYeri,
    gorevTanimi: gorev.gorevTanimi,
    cikisTarihi: iso(gorev.cikisTarihi),
    girisTarihi: iso(gorev.girisTarihi),
    sureSaat: num(gorev.sureSaat),
    kmSayacCikis: num(gorev.kmSayacCikis),
    kmSayacGiris: num(gorev.kmSayacGiris),
    kmFarki: num(gorev.kmFarki),
    maliyet: num(gorev.maliyet),
    not: gorev.not,
    vehicleId: gorev.vehicleId,
    vehicle: {
      id: gorev.vehicle.id,
      plaka: gorev.vehicle.plaka,
      ad: gorev.vehicle.ad,
      tip: gorev.vehicle.vehicleType?.name ?? null,
    },
    driverId: gorev.driverId,
    sofor: gorev.driver
      ? { id: gorev.driver.id, ad: gorev.driver.name, telefon: gorev.driver.phone }
      : null,
    talepEdenDepartmentId: gorev.talepEdenDepartmentId,
    talepEdenMudurluk: gorev.talepEdenDepartment?.name ?? null,
    onaylayanId: gorev.onaylayanId,
    onaylayan: gorev.onaylayan?.name ?? null,
    dispatch: gorev.dispatchJob
      ? {
          id: gorev.dispatchJob.id,
          tip: gorev.dispatchJob.tip,
          routeAd: gorev.dispatchJob.routeAd,
        }
      : null,
    takipOzeti: gorev.trackAnalysis
      ? {
          sonuc: gorev.trackAnalysis.sonuc,
          uyumYuzde: num(gorev.trackAnalysis.uyumYuzde),
          kapsamaYuzde: num(gorev.trackAnalysis.kapsamaYuzde),
        }
      : null,
  };
}

/**
 * Takip raporu verisi: web `/gorevler/[id]/takip` sayfasının gösterdiği tüm
 * metrikler, olay listeleri ve harita geometrileri.
 */
export async function gorevTakipRaporu(actor: ServiceActor, id: string) {
  await gorevErisim(actor, id);

  const [analiz, detay] = await Promise.all([
    prisma.routeTrackAnalysis.findUnique({ where: { taskId: id } }),
    prisma.vehicleTask.findUniqueOrThrow({
      where: { id },
      select: {
        gorevNo: true,
        gorevTanimi: true,
        cikisTarihi: true,
        girisTarihi: true,
        dispatchJobId: true,
        dispatchJob: {
          select: { tip: true, routeId: true, routeAd: true, rotaSnapshot: true },
        },
        vehicle: { select: { plaka: true } },
        driver: { select: { name: true } },
      },
    }),
  ]);

  const sapmalar = ((analiz?.sapmalar as unknown as SapmaDto[]) ?? []).filter(Boolean);
  const duraklamalar = (
    (analiz?.duraklamalar as unknown as DuraklamaDto[]) ?? []
  ).filter(Boolean);
  const bosluklar = (
    (analiz?.veriBosluklari as unknown as VeriBosluguDto[]) ?? []
  ).filter(Boolean);

  // Haritadaki planlanan rota, metrikleri üreten geometriyle aynı olmalı:
  // atama anındaki snapshot varsa o, yoksa güncel rota kullanılır.
  const rota = detay.dispatchJob ? await dispatchRotasi(detay.dispatchJob) : null;

  return {
    gorevNo: detay.gorevNo,
    gorevTanimi: detay.gorevTanimi,
    plaka: detay.vehicle.plaka,
    soforAdi: detay.driver?.name ?? null,
    cikisTarihi: iso(detay.cikisTarihi),
    girisTarihi: iso(detay.girisTarihi),
    /** Dispatch rotasına bağlı olmayan görevlerde analiz üretilmez. */
    dispatchVar: detay.dispatchJobId != null,
    analiz: analiz
      ? {
          tip: analiz.tip,
          routeAd: analiz.routeAd,
          sonuc: analiz.sonuc,
          veriKalitesi: analiz.veriKalitesi,
          notlar: analiz.notlar,
          rotaGiris: iso(analiz.rotaGiris),
          rotaCikis: iso(analiz.rotaCikis),
          sureDk: num(analiz.sureDk),
          uyumYuzde: num(analiz.uyumYuzde),
          kapsamaYuzde: num(analiz.kapsamaYuzde),
          maxSapmaM: num(analiz.maxSapmaM),
          ortSapmaM: num(analiz.ortSapmaM),
          ortalamaHizKmh: num(analiz.ortalamaHizKmh),
          maxHizKmh: num(analiz.maxHizKmh),
          toplamMesafeKm: num(analiz.toplamMesafeKm),
          pingSayisi: analiz.pingSayisi,
          ortPingAraligiSn: num(analiz.ortPingAraligiSn),
          guncellemeTarihi: iso(analiz.updatedAt),
        }
      : null,
    sapmalar,
    duraklamalar,
    veriBosluklari: bosluklar,
    zamanCizelgesi: takipZamanCizelgesi({
      rotaGiris: analiz?.rotaGiris ?? null,
      rotaCikis: analiz?.rotaCikis ?? null,
      sapmalar,
      duraklamalar,
      bosluklar,
    }),
    toplamSapmaDk: sapmalar.reduce((s, x) => s + x.sureDk, 0),
    toplamDuraklamaDk: duraklamalar.reduce((s, x) => s + x.sureDk, 0),
    harita: analiz
      ? {
          planlanan: (rota?.koordinatlar as [number, number][] | undefined) ?? [],
          eksikSegmentler:
            (analiz.eksikSegmentler as unknown as [number, number][][]) ?? [],
          iz:
            (analiz.izKoordinatlar as unknown as [
              number,
              number,
              number,
              number | null,
            ][]) ?? [],
        }
      : null,
  };
}

async function gorevErisim(actor: ServiceActor, id: string) {
  const gorev = await loadTaskForAccess(id);
  if (!gorev) throw new ServiceError("Görev bulunamadı", 404);
  if (!canAccessTask(toAccessUser(actor.user), gorev)) {
    throw new ServiceError("Yetkisiz", 403);
  }
  return gorev;
}
