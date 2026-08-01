import { ok, panelRoute } from "@/lib/api-route";
import { tanimlarVerisi } from "@/lib/services/definitions";

export const dynamic = "force-dynamic";

/** Yönetim ekranının tüm tanım kümesi (pasif kayıtlar dahil) */
export async function GET(req: Request) {
  return panelRoute(req, async (actor) => ok(await tanimlarVerisi(actor)));
}
