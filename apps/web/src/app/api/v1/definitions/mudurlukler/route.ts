import { created, panelRoute, readJson } from "@/lib/api-route";
import { mudurlukOlustur } from "@/lib/services/definitions";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return panelRoute(req, async (actor) =>
    created(await mudurlukOlustur(actor, await readJson(req))),
  );
}
