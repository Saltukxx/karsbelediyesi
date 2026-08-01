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
} from "@/lib/services/rota-ortak";

export const temizlikRotaInputSchema = z.object({
  ad: zorunluMetin("Rota adı gerekli"),
  koordinatlar: koordinatlarAlani,
  oncelik: oncelikAlani,
  notlar: opsiyonelMetin,
});

export type TemizlikRotaInput = z.input<typeof temizlikRotaInputSchema>;

export const temizlikRotaGuncelleInputSchema = z.object({
  ad: opsiyonelMetin,
  koordinatlar: koordinatlarAlani.optional(),
  oncelik: opsiyonelOncelik,
  aktif: mantiksalAlan.optional(),
  notlar: opsiyonelMetin,
});

export type TemizlikRotaGuncelleInput = z.input<
  typeof temizlikRotaGuncelleInputSchema
>;

export async function temizlikRotaOlustur(actor: ServiceActor, input: unknown) {
  rolGerekli(actor, ACTION_ROLES.temizlik);
  const data = temizlikRotaInputSchema.parse(input);

  const rota = await prisma.cleaningRoute.create({
    data: {
      ad: data.ad,
      koordinatlar: data.koordinatlar,
      oncelik: data.oncelik,
      notlar: data.notlar,
      createdById: actor.user.id,
    },
  });

  await auditKaydet(actor, "TEMIZLIK_ROTA_OLUSTUR", {
    varlik: "CleaningRoute",
    varlikId: rota.id,
    detay: { ad: rota.ad },
  });
  return serializeTemizlikRota(rota);
}

export async function temizlikRotaGuncelle(
  actor: ServiceActor,
  id: string,
  input: unknown,
) {
  rolGerekli(actor, ACTION_ROLES.temizlik);
  const data = temizlikRotaGuncelleInputSchema.parse(input);

  const mevcut = await prisma.cleaningRoute.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!mevcut) bulunamadi("Temizlik rotası");

  const rota = await prisma.cleaningRoute.update({
    where: { id },
    data: {
      ad: data.ad,
      koordinatlar: data.koordinatlar,
      oncelik: data.oncelik,
      aktif: data.aktif,
      notlar: alanGonderildi(input, "notlar") ? (data.notlar ?? null) : undefined,
    },
  });

  await auditKaydet(actor, "TEMIZLIK_ROTA_GUNCELLE", {
    varlik: "CleaningRoute",
    varlikId: id,
  });
  return serializeTemizlikRota(rota);
}

export async function temizlikRotaSil(actor: ServiceActor, id: string) {
  rolGerekli(actor, ACTION_ROLES.temizlik);

  const mevcut = await prisma.cleaningRoute.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!mevcut) bulunamadi("Temizlik rotası");

  const karar = await rotaSilVeyaPasifle("TEMIZLIK", id);
  const ad = karar.silindi
    ? (await prisma.cleaningRoute.delete({ where: { id } })).ad
    : undefined;

  await auditKaydet(actor, karar.silindi ? "TEMIZLIK_ROTA_SIL" : "TEMIZLIK_ROTA_PASIF", {
    varlik: "CleaningRoute",
    varlikId: id,
    detay: karar.silindi ? { ad } : { sebep: karar.sebep },
  });
  if (!karar.silindi) throw new ServiceError(karar.sebep, 409);

  return { id, ad };
}

/**
 * Temizlik rotalarının kendi operasyon kaydı yok; "son görev" bilgisi
 * dispatch atamalarından türetilir (web sayfasıyla aynı hesap).
 */
export async function temizlikRotaListesi(actor: ServiceActor) {
  const [rotalar, sonGorevler] = await Promise.all([
    prisma.cleaningRoute.findMany({ orderBy: [{ oncelik: "asc" }, { ad: "asc" }] }),
    prisma.dispatchJob.findMany({
      where: { tip: "TEMIZLIK", durum: "ATANDI" },
      orderBy: { createdAt: "desc" },
      distinct: ["routeId"],
      select: { routeId: true, createdAt: true },
    }),
  ]);

  const sonGorevByRoute = new Map(sonGorevler.map((j) => [j.routeId, j.createdAt]));

  return {
    duzenleyebilir: ACTION_ROLES.temizlik.includes(actor.user.role),
    rotalar: rotalar.map((r) => ({
      ...serializeTemizlikRota(r),
      sonGorev: iso(sonGorevByRoute.get(r.id) ?? null),
    })),
  };
}

function serializeTemizlikRota(rota: {
  id: string;
  ad: string;
  koordinatlar: unknown;
  oncelik: number;
  aktif: boolean;
  notlar: string | null;
}) {
  return {
    id: rota.id,
    ad: rota.ad,
    koordinatlar: rota.koordinatlar as [number, number][],
    oncelik: rota.oncelik,
    aktif: rota.aktif,
    notlar: rota.notlar,
  };
}
