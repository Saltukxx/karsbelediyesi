import { z } from "zod";
import { prisma } from "@kars/db";
import { iso } from "@/lib/api/serialize";
import { auditKaydet } from "@/lib/audit";
import { rotaSilVeyaPasifle } from "@/lib/route-delete";
import { ACTION_ROLES } from "@/lib/authz";
import {
  alanGonderildi,
  bulunamadi,
  mantiksalAlan,
  opsiyonelMetin,
  rolGerekli,
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

/** Toplama günleri ISO gün numarası (1 = Pazartesi … 7 = Pazar). */
const gunlerAlani = z
  .union([z.array(z.union([z.number(), z.string()])), z.string()])
  .transform((v) => {
    const ham = Array.isArray(v) ? v : v.split(",");
    const gunler = ham
      .map((g) => Number(g))
      .filter((g) => Number.isInteger(g) && g >= 1 && g <= 7);
    return [...new Set(gunler)].sort((a, b) => a - b);
  })
  .pipe(z.array(z.number()).min(1, "En az bir toplama günü seçin"));

export const copRotaInputSchema = z.object({
  ad: zorunluMetin("Rota adı gerekli"),
  koordinatlar: koordinatlarAlani,
  gunler: gunlerAlani,
  oncelik: oncelikAlani,
  notlar: opsiyonelMetin,
});

export type CopRotaInput = z.input<typeof copRotaInputSchema>;

export const copRotaGuncelleInputSchema = z.object({
  ad: opsiyonelMetin,
  koordinatlar: koordinatlarAlani.optional(),
  gunler: gunlerAlani.optional(),
  oncelik: opsiyonelOncelik,
  aktif: mantiksalAlan.optional(),
  notlar: opsiyonelMetin,
});

export type CopRotaGuncelleInput = z.input<typeof copRotaGuncelleInputSchema>;

export async function copRotaOlustur(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.cop);
  const data = copRotaInputSchema.parse(input);

  const rota = await prisma.wasteRoute.create({
    data: {
      ad: data.ad,
      koordinatlar: data.koordinatlar,
      gunler: data.gunler,
      oncelik: data.oncelik,
      notlar: data.notlar,
      createdById: actor.user.id,
    },
  });

  await auditKaydet(actor, "COP_ROTA_OLUSTUR", {
    varlik: "WasteRoute",
    varlikId: rota.id,
    detay: { ad: rota.ad },
  });
  return serializeCopRota(rota);
}

export async function copRotaGuncelle(
  actor: ServiceActor,
  id: string,
  input: unknown,
) {
  rolGerekli(actor, ACTION_ROLES.cop);
  const data = copRotaGuncelleInputSchema.parse(input);

  const mevcut = await prisma.wasteRoute.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!mevcut) bulunamadi("Çöp rotası");

  const rota = await prisma.wasteRoute.update({
    where: { id },
    data: {
      ad: data.ad,
      koordinatlar: data.koordinatlar,
      gunler: data.gunler,
      oncelik: data.oncelik,
      aktif: data.aktif,
      notlar: alanGonderildi(input, "notlar") ? (data.notlar ?? null) : undefined,
    },
  });

  await auditKaydet(actor, "COP_ROTA_GUNCELLE", {
    varlik: "WasteRoute",
    varlikId: id,
  });
  return serializeCopRota(rota);
}

export async function copRotaSil(actor: ServiceActor, id: string) {
  rolGerekli(actor, ACTION_ROLES.cop);

  const mevcut = await prisma.wasteRoute.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!mevcut) bulunamadi("Çöp rotası");

  const karar = await rotaSilVeyaPasifle("COP", id);
  const ad = karar.silindi
    ? (await prisma.wasteRoute.delete({ where: { id } })).ad
    : undefined;

  await auditKaydet(actor, karar.silindi ? "COP_ROTA_SIL" : "COP_ROTA_PASIF", {
    varlik: "WasteRoute",
    varlikId: id,
    detay: karar.silindi ? { ad } : { sebep: karar.sebep },
  });
  if (!karar.silindi) throw new ServiceError(karar.sebep, 409);

  return { id, ad };
}

// ── Toplama ──────────────────────────────────────────────────────────────────

export const copToplamaInputSchema = zamanAraligiSchema.extend({
  routeId: zorunluMetin("Rota seçimi gerekli"),
  vehicleId: opsiyonelMetin,
  driverId: opsiyonelMetin,
  notlar: opsiyonelMetin,
});

export type CopToplamaInput = z.input<typeof copToplamaInputSchema>;

export async function copToplamaOlustur(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.cop);
  const data = copToplamaInputSchema.parse(input);
  const { baslangic, bitis } = zamanAraligi(data);

  const rota = await prisma.wasteRoute.findUnique({
    where: { id: data.routeId },
    select: { id: true },
  });
  if (!rota) bulunamadi("Çöp rotası");

  const toplama = await prisma.wasteCollection.create({
    data: {
      routeId: data.routeId,
      vehicleId: data.vehicleId,
      driverId: data.driverId,
      baslangic,
      bitis,
      notlar: data.notlar,
      createdById: actor.user.id,
    },
  });

  await auditKaydet(actor, "COP_TOPLAMA_OLUSTUR", {
    varlik: "WasteCollection",
    varlikId: toplama.id,
    detay: { routeId: data.routeId },
  });
  return serializeToplama(toplama);
}

export async function copToplamaSil(actor: ServiceActor, id: string) {
  rolGerekli(actor, ACTION_ROLES.cop);

  const mevcut = await prisma.wasteCollection.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!mevcut) bulunamadi("Toplama kaydı");

  await prisma.wasteCollection.delete({ where: { id } });
  await auditKaydet(actor, "COP_TOPLAMA_SIL", {
    varlik: "WasteCollection",
    varlikId: id,
  });
  return { id };
}

// ── Okuma ────────────────────────────────────────────────────────────────────

export async function copRotaListesi(actor: ServiceActor) {
  const rotalar = await prisma.wasteRoute.findMany({
    orderBy: [{ oncelik: "asc" }, { ad: "asc" }],
    include: {
      collections: {
        orderBy: { baslangic: "desc" },
        take: 5,
        include: {
          vehicle: { select: { plaka: true } },
          driver: { select: { name: true } },
        },
      },
    },
  });

  return {
    duzenleyebilir: ACTION_ROLES.cop.includes(actor.user.role),
    rotalar: rotalar.map((r) => ({
      ...serializeCopRota(r),
      sonToplama: iso(r.collections[0]?.baslangic ?? null),
      sonToplamalar: r.collections.map((c) => ({
        ...serializeToplama(c),
        plaka: c.vehicle?.plaka ?? null,
        soforAdi: c.driver?.name ?? null,
      })),
    })),
  };
}

// ── Yardımcılar ──────────────────────────────────────────────────────────────

function serializeCopRota(rota: {
  id: string;
  ad: string;
  koordinatlar: unknown;
  gunler: unknown;
  oncelik: number;
  aktif: boolean;
  notlar: string | null;
}) {
  return {
    id: rota.id,
    ad: rota.ad,
    koordinatlar: rota.koordinatlar as [number, number][],
    gunler: rota.gunler as number[],
    oncelik: rota.oncelik,
    aktif: rota.aktif,
    notlar: rota.notlar,
  };
}

function serializeToplama(toplama: {
  id: string;
  routeId: string;
  vehicleId: string | null;
  driverId: string | null;
  baslangic: Date;
  bitis: Date | null;
  notlar: string | null;
}) {
  return {
    id: toplama.id,
    routeId: toplama.routeId,
    vehicleId: toplama.vehicleId,
    driverId: toplama.driverId,
    baslangic: iso(toplama.baslangic),
    bitis: iso(toplama.bitis),
    notlar: toplama.notlar,
  };
}
