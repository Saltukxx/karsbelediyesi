import { created, ok, panelRoute, readJson } from "@/lib/api-route";
import { kisRotaListesi, kisRotaOlustur } from "@/lib/services/kis";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return panelRoute(req, async (actor) => ok(await kisRotaListesi(actor)));
}

export async function POST(req: Request) {
  return panelRoute(req, async (actor) =>
    created(await kisRotaOlustur(actor, await readJson(req))),
  );
}
