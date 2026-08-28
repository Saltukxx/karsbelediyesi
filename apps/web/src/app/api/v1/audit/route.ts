import { ACTION_ROLES } from "@/lib/authz";
import { listLimit } from "@/lib/api-v1";
import { handleV1Get } from "@/lib/v1-handler";
import { denetimListesiForUser } from "@/lib/domain/crud-for-user";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limit = listLimit(req);
  return handleV1Get(req, ACTION_ROLES.definitions, (session) =>
    denetimListesiForUser(session.user, limit),
  );
}
