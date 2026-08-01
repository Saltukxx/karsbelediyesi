import { created, panelRoute, readJson } from "@/lib/api-route";
import { kisOperasyonOlustur } from "@/lib/services/kis";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return panelRoute(req, async (actor) =>
    created(await kisOperasyonOlustur(actor, await readJson(req))),
  );
}
