import { gun } from "@/lib/api/serialize";
import { created, panelRoute, readJson } from "@/lib/api-route";
import { personelGunlukOlustur } from "@/lib/services/worklogs";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return panelRoute(req, async (actor) => {
    const log = await personelGunlukOlustur(actor, await readJson(req));
    return created({
      id: log.id,
      personnelId: log.personnelId,
      tarih: gun(log.tarih),
      girisSaati: log.girisSaati,
      cikisSaati: log.cikisSaati,
      // Saatler Excel formülleriyle sunucuda hesaplanır
      normalSaat: log.normalSaat,
      mesaiSaat: log.mesaiSaat,
      toplamSaat: log.toplamSaat,
      calismaTipi: log.calismaTipi,
    });
  });
}
