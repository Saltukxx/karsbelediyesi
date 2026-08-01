import { ok, panelRoute, readJson } from "@/lib/api-route";
import { mudurlukGuncelle } from "@/lib/services/definitions";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return panelRoute(req, async (actor) =>
    ok(await mudurlukGuncelle(actor, id, await readJson(req))),
  );
}
