import { created, ok, panelRoute, readJson } from "@/lib/api-route";
import { asfaltYolOlustur, haritaKatmanlari } from "@/lib/services/harita";

export const dynamic = "force-dynamic";

/** Yalnız asfalt yol katmanı (harita düzenleme ekranının listesi). */
export async function GET(req: Request) {
  return panelRoute(req, async (actor) => {
    const katmanlar = await haritaKatmanlari(actor);
    return ok(katmanlar.yollar);
  });
}

export async function POST(req: Request) {
  return panelRoute(req, async (actor) =>
    created(await asfaltYolOlustur(actor, await readJson(req))),
  );
}
