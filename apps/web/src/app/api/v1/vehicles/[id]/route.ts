import { ACTION_ROLES } from "@/lib/authz";
import { handleV1Write, str } from "@/lib/v1-handler";
import { aracHurdayaAyirForUser, aracGuncelleForUser } from "@/lib/domain/fleet";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return handleV1Write(req, ACTION_ROLES.vehicles, async (session, body) => {
    if (str(body, "action") === "hurdaya") {
      return aracHurdayaAyirForUser(session, id);
    }
    return aracGuncelleForUser(session, { id, plaka: str(body, "plaka"), ...body } as never);
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return handleV1Write(req, ACTION_ROLES.vehicles, (session) =>
    aracHurdayaAyirForUser(session, id),
  );
}
