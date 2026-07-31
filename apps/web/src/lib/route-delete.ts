import { prisma } from "@kars/db";
import type { DispatchTip } from "@kars/db";

/**
 * Rota silme koruması: aktif öneri/atama ya da geçmiş görev referansı olan
 * rota fiziksel olarak silinemez — aksi halde takip raporları ve dispatch
 * kayıtları dayanaksız kalır. Bu durumda rota pasife çekilir (soft delete).
 */
export type RotaSilmeSonuc =
  | { silindi: true }
  | { silindi: false; sebep: string };

async function rotaKullanimda(
  tip: DispatchTip,
  routeId: string,
): Promise<string | null> {
  const [aktifOneri, gorevli] = await Promise.all([
    prisma.dispatchJob.count({
      where: { tip, routeId, durum: { in: ["ONERILDI", "ATANDI"] } },
    }),
    prisma.dispatchJob.count({ where: { tip, routeId, task: { isNot: null } } }),
  ]);

  if (aktifOneri > 0) return "Bu rota için bekleyen öneri veya süren görev var";
  if (gorevli > 0) return "Bu rotaya bağlı görev kaydı var";
  return null;
}

/**
 * Rotayı siler; kullanımdaysa siler yerine pasife çeker ve sebebi döner.
 */
export async function rotaSilVeyaPasifle(
  tip: DispatchTip,
  routeId: string,
): Promise<RotaSilmeSonuc> {
  const sebep = await rotaKullanimda(tip, routeId);
  if (!sebep) return { silindi: true };

  switch (tip) {
    case "KIS":
      await prisma.winterRoute.update({ where: { id: routeId }, data: { aktif: false } });
      break;
    case "COP":
      await prisma.wasteRoute.update({ where: { id: routeId }, data: { aktif: false } });
      break;
    case "TEMIZLIK":
      await prisma.cleaningRoute.update({
        where: { id: routeId },
        data: { aktif: false },
      });
      break;
    default: {
      const _exhaustive: never = tip;
      return _exhaustive;
    }
  }

  return { silindi: false, sebep: `${sebep}; rota silinmedi, pasife alındı.` };
}
