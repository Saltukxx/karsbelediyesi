import { created, ok, panelRoute, readJson } from "@/lib/api-route";
import { cihazKaldir, cihazKaydet } from "@/lib/services/devices";

export const dynamic = "force-dynamic";

/** APNs cihaz token kaydı — uygulama açılışında ve token yenilendiğinde */
export async function POST(req: Request) {
  return panelRoute(req, async (actor) =>
    created(await cihazKaydet(actor, await readJson(req))),
  );
}

/** Çıkışta cihazı pasifleştirir */
export async function DELETE(req: Request) {
  return panelRoute(req, async (actor) =>
    ok(await cihazKaldir(actor, await readJson(req))),
  );
}
