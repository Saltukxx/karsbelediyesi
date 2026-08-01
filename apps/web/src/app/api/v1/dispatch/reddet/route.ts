import { ok, panelRoute, readJson } from "@/lib/api-route";
import { dispatchOneriReddet } from "@/lib/services/dispatch";

export const dynamic = "force-dynamic";

/** Bekleyen öneriyi reddet — rota yeniden önerilebilir hale gelir */
export async function POST(req: Request) {
  return panelRoute(req, async (actor) =>
    ok(await dispatchOneriReddet(actor, await readJson(req))),
  );
}
