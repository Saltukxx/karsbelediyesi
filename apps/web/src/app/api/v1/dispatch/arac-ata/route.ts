import { created, panelRoute, readJson } from "@/lib/api-route";
import { dispatchAracAta } from "@/lib/services/dispatch";

export const dynamic = "force-dynamic";

/** Seçilen aracı rotaya ata ve görevi tek adımda aç */
export async function POST(req: Request) {
  return panelRoute(req, async (actor) =>
    created(await dispatchAracAta(actor, await readJson(req))),
  );
}
