import { created, panelRoute, readJson } from "@/lib/api-route";
import { dispatchOneriAta } from "@/lib/services/dispatch";

export const dynamic = "force-dynamic";

/** Bekleyen öneriyi kabul et — görev açılır, araç yola çıkar */
export async function POST(req: Request) {
  return panelRoute(req, async (actor) =>
    created(await dispatchOneriAta(actor, await readJson(req))),
  );
}
