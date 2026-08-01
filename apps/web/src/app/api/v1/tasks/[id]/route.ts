import { z } from "zod";
import { ok, panelRoute, readJson } from "@/lib/api-route";
import { ServiceError } from "@/lib/services/base";
import { gorevBaslat, gorevDetay, gorevKapat } from "@/lib/services/tasks";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Web'in "Başlat" / "Kapat" formlarının JSON karşılığı. */
const eylemSchema = z.object({
  action: z.enum(["start", "close"]),
});

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return panelRoute(req, async (actor) => ok(await gorevDetay(actor, id)));
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return panelRoute(req, async (actor) => {
    const body = await readJson(req);
    const { action } = eylemSchema.parse(body);

    switch (action) {
      case "start":
        await gorevBaslat(actor, id, body);
        break;
      case "close":
        await gorevKapat(actor, id, body);
        break;
      default: {
        const _tukendi: never = action;
        throw new ServiceError(`Bilinmeyen eylem: ${String(_tukendi)}`);
      }
    }

    return ok(await gorevDetay(actor, id));
  });
}
