import { ok, panelRoute } from "@/lib/api-route";
import { bildirimOkundu } from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

/** Tek bildirimi okundu işaretler */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return panelRoute(req, async (actor) => ok(await bildirimOkundu(actor, id)));
}
