import { created, ok, panelRoute, readJson } from "@/lib/api-route";
import { copRotaListesi, copRotaOlustur } from "@/lib/services/cop";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return panelRoute(req, async (actor) => ok(await copRotaListesi(actor)));
}

export async function POST(req: Request) {
  return panelRoute(req, async (actor) =>
    created(await copRotaOlustur(actor, await readJson(req))),
  );
}
