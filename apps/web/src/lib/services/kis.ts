import { z } from "zod";
import { KisOperasyonTip, KisRotaTip, prisma } from "@kars/db";
import { mevcutStok } from "@kars/shared";
import { iso, num } from "@/lib/api/serialize";
import { auditKaydet } from "@/lib/audit";
import { rotaSilVeyaPasifle } from "@/lib/route-delete";
import { ACTION_ROLES } from "@/lib/authz";
import {
  alanGonderildi,
  bulunamadi,
  enumAlani,
  mantiksalAlan,
  opsiyonelMetin,
  rolGerekli,
  sayiAlani,
  ServiceError,
  zorunluMetin,
  type ServiceActor,
} from "@/lib/services/base";
import {
  koordinatlarAlani,
  oncelikAlani,
  opsiyonelOncelik,
  zamanAraligi,
  zamanAraligiSchema,
} from "@/lib/services/rota-ortak";

// ── Rotalar ──────────────────────────────────────────────────────────────────

export const kisRotaInputSchema = z.object({
  ad: zorunluMetin("Rota adı gerekli"),
  koordinatlar: koordinatlarAlani,
  tip: enumAlani(KisRotaTip, KisRotaTip.KARMA),
  oncelik: oncelikAlani,
  notlar: opsiyonelMetin,
});

export type KisRotaInput = z.input<typeof kisRotaInputSchema>;

export const kisRotaGuncelleInputSchema = z.object({
  ad: opsiyonelMetin,
  koordinatlar: koordinatlarAlani.optional(),
  tip: z.nativeEnum(KisRotaTip).optional(),
  oncelik: opsiyonelOncelik,
  aktif: mantiksalAlan.optional(),
  notlar: opsiyonelMetin,
});

export type KisRotaGuncelleInput = z.input<typeof kisRotaGuncelleInputSchema>;

export async function kisRotaOlustur(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.kis);
  const data = kisRotaInputSchema.parse(input);

  const rota = await prisma.winterRoute.create({
    data: {
      ad: data.ad,
      koordinatlar: data.koordinatlar,
      tip: data.tip,
      oncelik: data.oncelik,
      notlar: data.notlar,
      createdById: actor.user.id,
    },
  });

  await auditKaydet(actor, "KIS_ROTA_OLUSTUR", {
    varlik: "WinterRoute",
    varlikId: rota.id,
    detay: { ad: rota.ad },
  });
  return serializeKisRota(rota);
}

export async function kisRotaGuncelle(
  actor: ServiceActor,
  id: string,
  input: unknown,
) {
  rolGerekli(actor, ACTION_ROLES.kis);
  const data = kisRotaGuncelleInputSchema.parse(input);

  const mevcut = await prisma.winterRoute.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!mevcut) bulunamadi("Kış rotası");

  const rota = await prisma.winterRoute.update({
    where: { id },
    data: {
      ad: data.ad,
      koordinatlar: data.koordinatlar,
      tip: data.tip,
      oncelik: data.oncelik,
      aktif: data.aktif,
      notlar: alanGonderildi(input, "notlar") ? (data.notlar ?? null) : undefined,
    },
  });

  await auditKaydet(actor, "KIS_ROTA_GUNCELLE", {
    varlik: "WinterRoute",
    varlikId: id,
  });
  return serializeKisRota(rota);
}

/** Kullanımdaki rota silinmez, pasife alınır ve 409 döner. */
export async function kisRotaSil(actor: ServiceActor, id: string) {
  rolGerekli(actor, ACTION_ROLES.kis);

  const mevcut = await prisma.winterRoute.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!mevcut) bulunamadi("Kış rotası");

  const karar = await rotaSilVeyaPasifle("KIS", id);
  const ad = karar.silindi
    ? (await prisma.winterRoute.delete({ where: { id } })).ad
    : undefined;

  await auditKaydet(actor, karar.silindi ? "KIS_ROTA_SIL" : "KIS_ROTA_PASIF", {
    varlik: "WinterRoute",
    varlikId: id,
    detay: karar.silindi ? { ad } : { sebep: karar.sebep },
  });
  if (!karar.silindi) throw new ServiceError(karar.sebep, 409);

  return { id, ad };
}

// ── Operasyonlar ─────────────────────────────────────────────────────────────

export const kisOperasyonInputSchema = zamanAraligiSchema.extend({
  routeId: zorunluMetin("Rota seçimi gerekli"),
  tip: enumAlani(KisOperasyonTip, KisOperasyonTip.KARMA),
  vehicleId: opsiyonelMetin,
  driverId: opsiyonelMetin,
  tuzKg: sayiAlani(z.number().positive("Tuz miktarı 0'dan büyük olmalı")).optional(),
  tuzMaterialId: opsiyonelMetin,
  notlar: opsiyonelMetin,
});

export type KisOperasyonInput = z.input<typeof kisOperasyonInputSchema>;

/**
 * Kış operasyonu kaydı. Tuz girildiyse depo stoğundan otomatik çıkış hareketi
 * yazılır; stok yetersizse işlem tümüyle geri alınır.
 */
export async function kisOperasyonOlustur(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.kis);
  const data = kisOperasyonInputSchema.parse(input);
  const { baslangic, bitis } = zamanAraligi(data);

  if (data.tuzKg != null && !data.tuzMaterialId) {
    throw new ServiceError("Tuz düşümü için malzeme seçimi gerekli");
  }

  const rota = await prisma.winterRoute.findUnique({
    where: { id: data.routeId },
    select: { id: true },
  });
  if (!rota) bulunamadi("Kış rotası");

  const operasyon = await prisma.$transaction(async (tx) => {
    const op = await tx.winterOperation.create({
      data: {
        routeId: data.routeId,
        tip: data.tip,
        vehicleId: data.vehicleId,
        driverId: data.driverId,
        baslangic,
        bitis,
        tuzKg: data.tuzKg,
        notlar: data.notlar,
        createdById: actor.user.id,
      },
    });

    if (data.tuzKg != null && data.tuzMaterialId) {
      const hareketler = await tx.materialMovement.findMany({
        where: { materialId: data.tuzMaterialId },
        select: { tip: true, miktar: true },
      });
      const giris = hareketler
        .filter((m) => m.tip === "GIRIS")
        .reduce((s, m) => s + Number(m.miktar), 0);
      const cikis = hareketler
        .filter((m) => m.tip === "CIKIS")
        .reduce((s, m) => s + Number(m.miktar), 0);
      const stok = mevcutStok(giris, cikis);
      if (data.tuzKg > stok) {
        throw new ServiceError(`Yetersiz tuz stoğu (mevcut: ${stok})`);
      }
      await tx.materialMovement.create({
        data: {
          materialId: data.tuzMaterialId,
          tarih: baslangic,
          tip: "CIKIS",
          miktar: data.tuzKg,
          aciklama: `Kış operasyonu tuz düşümü (${op.id})`,
          winterOperationId: op.id,
        },
      });
    }

    return op;
  });

  await auditKaydet(actor, "KIS_OPERASYON_OLUSTUR", {
    varlik: "WinterOperation",
    varlikId: operasyon.id,
    detay: { routeId: data.routeId, tip: data.tip, tuzKg: data.tuzKg },
  });

  return serializeKisOperasyon(operasyon);
}

/** Operasyon silinince tuz düşümü de geri alınır. */
export async function kisOperasyonSil(actor: ServiceActor, id: string) {
  rolGerekli(actor, ACTION_ROLES.kis);

  const mevcut = await prisma.winterOperation.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!mevcut) bulunamadi("Kış operasyonu");

  await prisma.$transaction(async (tx) => {
    await tx.materialMovement.deleteMany({ where: { winterOperationId: id } });
    await tx.winterOperation.delete({ where: { id } });
  });

  await auditKaydet(actor, "KIS_OPERASYON_SIL", {
    varlik: "WinterOperation",
    varlikId: id,
  });
  return { id };
}

// ── Okuma ────────────────────────────────────────────────────────────────────

/** Kış ekranı: rotalar, son operasyonlar ve stok bilgisiyle malzemeler. */
export async function kisRotaListesi(actor: ServiceActor) {
  const [rotalar, malzemeler, stokToplamlari] = await Promise.all([
    prisma.winterRoute.findMany({
      orderBy: [{ oncelik: "asc" }, { ad: "asc" }],
      include: {
        operations: {
          orderBy: { baslangic: "desc" },
          take: 5,
          include: {
            vehicle: { select: { plaka: true } },
            driver: { select: { name: true } },
          },
        },
      },
    }),
    prisma.material.findMany({
      where: { aktif: true },
      orderBy: { ad: "asc" },
      select: { id: true, kod: true, ad: true, birim: true, kategori: true },
    }),
    prisma.materialMovement.groupBy({
      by: ["materialId", "tip"],
      _sum: { miktar: true },
    }),
  ]);

  const stok = new Map<string, { giris: number; cikis: number }>();
  for (const satir of stokToplamlari) {
    const kayit = stok.get(satir.materialId) ?? { giris: 0, cikis: 0 };
    const miktar = Number(satir._sum.miktar ?? 0);
    if (satir.tip === "GIRIS") kayit.giris += miktar;
    else kayit.cikis += miktar;
    stok.set(satir.materialId, kayit);
  }

  return {
    duzenleyebilir: ACTION_ROLES.kis.includes(actor.user.role),
    rotalar: rotalar.map((r) => ({
      ...serializeKisRota(r),
      sonOperasyon: iso(r.operations[0]?.baslangic ?? null),
      sonOperasyonlar: r.operations.map((o) => ({
        ...serializeKisOperasyon(o),
        plaka: o.vehicle?.plaka ?? null,
        soforAdi: o.driver?.name ?? null,
      })),
    })),
    malzemeler: malzemeler.map((m) => {
      const kayit = stok.get(m.id) ?? { giris: 0, cikis: 0 };
      return { ...m, stok: mevcutStok(kayit.giris, kayit.cikis) };
    }),
  };
}

// ── Yardımcılar ──────────────────────────────────────────────────────────────

function serializeKisRota(rota: {
  id: string;
  ad: string;
  koordinatlar: unknown;
  tip: KisRotaTip;
  oncelik: number;
  aktif: boolean;
  notlar: string | null;
}) {
  return {
    id: rota.id,
    ad: rota.ad,
    koordinatlar: rota.koordinatlar as [number, number][],
    tip: rota.tip,
    oncelik: rota.oncelik,
    aktif: rota.aktif,
    notlar: rota.notlar,
  };
}

function serializeKisOperasyon(op: {
  id: string;
  routeId: string;
  tip: KisOperasyonTip;
  vehicleId: string | null;
  driverId: string | null;
  baslangic: Date;
  bitis: Date | null;
  tuzKg: unknown;
  notlar: string | null;
}) {
  return {
    id: op.id,
    routeId: op.routeId,
    tip: op.tip,
    vehicleId: op.vehicleId,
    driverId: op.driverId,
    baslangic: iso(op.baslangic),
    bitis: iso(op.bitis),
    tuzKg: num(op.tuzKg as Parameters<typeof num>[0]),
    notlar: op.notlar,
  };
}
