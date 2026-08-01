import { ok, panelRoute } from "@/lib/api-route";
import { tumBildirimlerOkundu } from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

/** Kullanıcının tüm bildirimlerini okundu sayar */
export async function POST(req: Request) {
  return panelRoute(req, async (actor) => ok(await tumBildirimlerOkundu(actor)));
}
