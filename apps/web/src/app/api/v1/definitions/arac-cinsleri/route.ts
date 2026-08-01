import { created, panelRoute, readJson } from "@/lib/api-route";
import { aracCinsiOlustur } from "@/lib/services/definitions";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return panelRoute(req, async (actor) =>
    created(await aracCinsiOlustur(actor, await readJson(req))),
  );
}
