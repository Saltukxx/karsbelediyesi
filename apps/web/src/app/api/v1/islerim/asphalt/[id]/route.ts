import type { AsfaltDurum } from "@kars/db";
import { handleV1Write, str } from "@/lib/v1-handler";
import { islerimAsfaltDurumForUser } from "@/lib/domain/islerim";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return handleV1Write(req, ["ADMIN", "DRIVER", "FIELD_WORKER"], (session, body) =>
    islerimAsfaltDurumForUser(session, {
      id,
      durum: str(body, "durum") as AsfaltDurum,
    }),
  );
}
