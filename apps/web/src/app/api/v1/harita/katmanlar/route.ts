import { ok, panelRoute } from "@/lib/api-route";
import { haritaKatmanlari } from "@/lib/services/harita";

export const dynamic = "force-dynamic";

/** Harita ekranının tüm katmanları: yollar, engeller, şikayet pinleri, araçlar. */
export async function GET(req: Request) {
  return panelRoute(req, async (actor) => ok(await haritaKatmanlari(actor)));
}
