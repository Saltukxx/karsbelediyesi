import { created, panelRoute, readJson } from "@/lib/api-route";
import { dispatchOneriUret } from "@/lib/services/dispatch";

export const dynamic = "force-dynamic";

/** Rota için en uygun aracı bul ve bekleyen öneri üret */
export async function POST(req: Request) {
  return panelRoute(req, async (actor) =>
    created(await dispatchOneriUret(actor, await readJson(req))),
  );
}
