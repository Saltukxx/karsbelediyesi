import { ok, panelRoute, readJson } from "@/lib/api-route";
import { otomatikAtamaKaydet } from "@/lib/services/definitions";

export const dynamic = "force-dynamic";

/** Akıllı dispatch tam otomatik atama anahtarı */
export async function PUT(req: Request) {
  return panelRoute(req, async (actor) =>
    ok(await otomatikAtamaKaydet(actor, await readJson(req))),
  );
}
