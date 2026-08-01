import { ok, panelRoute } from "@/lib/api-route";
import { komutaVerisi } from "@/lib/services/komuta";

export const dynamic = "force-dynamic";

/** Komuta ekranı canlı verisi — istemci 30 sn'de bir çeker */
export async function GET(req: Request) {
  return panelRoute(req, async (actor) => ok(await komutaVerisi(actor)));
}
