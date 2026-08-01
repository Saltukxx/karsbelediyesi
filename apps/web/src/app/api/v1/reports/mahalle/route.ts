import { ok, panelRoute } from "@/lib/api-route";
import { mahalleAnalizi } from "@/lib/services/reports";

export const dynamic = "force-dynamic";

/** Mahalle bazlı şikayet analizi; `gun` verilmezse son 90 gün */
export async function GET(req: Request) {
  const gun = new URL(req.url).searchParams.get("gun") ?? undefined;
  return panelRoute(req, async (actor) => ok(await mahalleAnalizi(actor, { gun })));
}
