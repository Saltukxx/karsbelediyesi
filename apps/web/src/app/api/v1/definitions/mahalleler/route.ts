import { created, panelRoute, readJson } from "@/lib/api-route";
import { mahalleOlustur } from "@/lib/services/definitions";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return panelRoute(req, async (actor) =>
    created(await mahalleOlustur(actor, await readJson(req))),
  );
}
