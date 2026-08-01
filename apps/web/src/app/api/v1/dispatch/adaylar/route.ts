import { ok, panelRoute } from "@/lib/api-route";
import { dispatchAdaylari } from "@/lib/services/dispatch";

export const dynamic = "force-dynamic";

/** Rota için skorlanmış araç adayları — `?tip=KIS&routeId=...` */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  return panelRoute(req, async (actor) =>
    ok(
      await dispatchAdaylari(actor, {
        tip: q.get("tip"),
        routeId: q.get("routeId"),
      }),
    ),
  );
}
