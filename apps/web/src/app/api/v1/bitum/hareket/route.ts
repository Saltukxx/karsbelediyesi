import { prisma } from "@kars/db";
import { BITUM_HAREKET_INCLUDE, bitumHareketDto } from "@/lib/api/bitum-dto";
import { created, panelRoute, readJson } from "@/lib/api-route";
import { bitumHareketOlustur } from "@/lib/services/bitum";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return panelRoute(req, async (actor) => {
    const hareket = await bitumHareketOlustur(actor, await readJson(req));
    const tam = await prisma.bitumMovement.findUniqueOrThrow({
      where: { id: hareket.id },
      include: BITUM_HAREKET_INCLUDE,
    });
    return created(bitumHareketDto(tam));
  });
}
