import { agregaFizikselMaliyet, agregaProjeMaliyet } from "@kars/shared";
import { ok, panelRoute } from "@/lib/api-route";
import { agregaVerisi } from "@/lib/agrega-model";

export const dynamic = "force-dynamic";

/**
 * `/agrega` sayfasının tamamı: kayıtlı parametreler + fiziksel maliyet modeli
 * (Agrega Maliyet Analizi 2) + proje modeli (₺/ton kalemleri).
 */
export async function GET(req: Request) {
  return panelRoute(req, async () => {
    const { params, fiziksel, proje, boyutSatis } = await agregaVerisi();
    return ok({
      parametreler: params,
      boyutSatis,
      fizikselMaliyet: fiziksel ? agregaFizikselMaliyet(fiziksel) : null,
      projeMaliyeti: proje ? agregaProjeMaliyet(proje) : null,
    });
  });
}
