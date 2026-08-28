import type { SikayetDurum } from "@kars/db";
import { handleV1Write, str, optStr } from "@/lib/v1-handler";
import { islerimSikayetDurumForUser } from "@/lib/domain/islerim";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return handleV1Write(req, ["ADMIN", "DRIVER", "FIELD_WORKER"], (session, body) =>
    islerimSikayetDurumForUser(session, {
      id,
      durum: str(body, "durum") as SikayetDurum,
      cozumNotu: optStr(body, "cozumNotu"),
      cozumFotolari: body.cozumFotolari as never,
    }),
  );
}
