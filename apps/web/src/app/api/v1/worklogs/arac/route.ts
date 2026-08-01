import { gun, num } from "@/lib/api/serialize";
import { created, panelRoute, readJson } from "@/lib/api-route";
import { aracGunlukOlustur } from "@/lib/services/worklogs";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return panelRoute(req, async (actor) => {
    const log = await aracGunlukOlustur(actor, await readJson(req));
    return created({
      id: log.id,
      vehicleId: log.vehicleId,
      tarih: gun(log.tarih),
      driverId: log.driverId,
      soforAdi: log.soforAdi,
      girisSaati: log.girisSaati,
      cikisSaati: log.cikisSaati,
      calismaSaati: log.calismaSaati,
      yakitLitre: num(log.yakitLitre),
    });
  });
}
