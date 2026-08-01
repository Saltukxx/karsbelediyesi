import { agregaFizikselMaliyet, agregaProjeMaliyet } from "@kars/shared";
import { ok, panelRoute, readJson } from "@/lib/api-route";
import { boyutSatisOku, fizikselGirdi, projeGirdi } from "@/lib/agrega-model";
import { agregaParametreKaydet } from "@/lib/services/agrega";

export const dynamic = "force-dynamic";

/** Parametreleri kaydeder ve yeniden hesaplanmış modelleri döner. */
export async function POST(req: Request) {
  return panelRoute(req, async (actor) => {
    const params = await agregaParametreKaydet(actor, await readJson(req));
    const boyutSatis = boyutSatisOku(params);
    return ok({
      parametreler: params,
      boyutSatis,
      fizikselMaliyet: agregaFizikselMaliyet(fizikselGirdi(params)),
      projeMaliyeti: agregaProjeMaliyet(projeGirdi(params, boyutSatis)),
    });
  });
}
