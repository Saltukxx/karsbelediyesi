import { gun } from "@/lib/api/serialize";
import { created, panelRoute, readJson } from "@/lib/api-route";
import { betonUretimOlustur } from "@/lib/services/concrete";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return panelRoute(req, async (actor) => {
    const uretim = await betonUretimOlustur(actor, await readJson(req));
    return created({
      id: uretim.id,
      tarih: gun(uretim.tarih),
      recipeId: uretim.recipeId,
      hedefM3: uretim.hedefM3,
      cimentoKg: uretim.cimentoKg,
      kumKg: uretim.kumKg,
      micir05Kg: uretim.micir05Kg,
      micir512Kg: uretim.micir512Kg,
      micir1219Kg: uretim.micir1219Kg,
      suLt: uretim.suLt,
      katkiKg: uretim.katkiKg,
      notlar: uretim.notlar,
    });
  });
}
