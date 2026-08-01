import { created, ok, panelRoute, readJson } from "@/lib/api-route";
import { temizlikRotaListesi, temizlikRotaOlustur } from "@/lib/services/temizlik";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return panelRoute(req, async (actor) => ok(await temizlikRotaListesi(actor)));
}

export async function POST(req: Request) {
  return panelRoute(req, async (actor) =>
    created(await temizlikRotaOlustur(actor, await readJson(req))),
  );
}
