import { created, panelRoute, readJson } from "@/lib/api-route";
import { kullaniciOlustur } from "@/lib/services/definitions";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return panelRoute(req, async (actor) =>
    created(await kullaniciOlustur(actor, await readJson(req))),
  );
}
