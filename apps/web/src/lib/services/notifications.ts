import { z } from "zod";
import { prisma } from "@kars/db";
import { bulunamadi, opsiyonelSayi, type ServiceActor } from "@/lib/services/base";

/**
 * Bildirim kutusu. Rol kısıtı yoktur: her kullanıcı yalnız kendi
 * bildirimlerini okur ve okundu işaretler.
 */

const VARSAYILAN_LIMIT = 20;
const MAKS_LIMIT = 100;

export const bildirimSorguSchema = z.object({
  limit: opsiyonelSayi(z.number().int().min(1).max(MAKS_LIMIT)),
  /** Yalnız okunmamışlar */
  okunmamis: z
    .union([z.boolean(), z.string(), z.null()])
    .optional()
    .transform((v) => v === true || v === "1" || v === "true"),
});

export interface BildirimDto {
  id: string;
  tip: string;
  baslik: string;
  mesaj: string | null;
  href: string | null;
  okundu: boolean;
  createdAt: string;
}

export interface BildirimListesiDto {
  unread: number;
  items: BildirimDto[];
}

export async function bildirimListesi(
  actor: ServiceActor,
  input: unknown = {},
): Promise<BildirimListesiDto> {
  const { limit, okunmamis } = bildirimSorguSchema.parse(input);
  const userId = actor.user.id;

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, ...(okunmamis ? { okundu: false } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit ?? VARSAYILAN_LIMIT,
      select: {
        id: true,
        tip: true,
        baslik: true,
        mesaj: true,
        href: true,
        okundu: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where: { userId, okundu: false } }),
  ]);

  return {
    unread,
    items: items.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
  };
}

/** Tek bildirimi okundu işaretler; başkasının bildirimi 404 döner. */
export async function bildirimOkundu(
  actor: ServiceActor,
  id: string,
): Promise<{ id: string; okundu: true; unread: number }> {
  const sonuc = await prisma.notification.updateMany({
    where: { id, userId: actor.user.id },
    data: { okundu: true },
  });
  if (sonuc.count === 0) bulunamadi("Bildirim");

  const unread = await prisma.notification.count({
    where: { userId: actor.user.id, okundu: false },
  });
  return { id, okundu: true, unread };
}

export async function tumBildirimlerOkundu(
  actor: ServiceActor,
): Promise<{ okunan: number; unread: 0 }> {
  const sonuc = await prisma.notification.updateMany({
    where: { userId: actor.user.id, okundu: false },
    data: { okundu: true },
  });
  return { okunan: sonuc.count, unread: 0 };
}
