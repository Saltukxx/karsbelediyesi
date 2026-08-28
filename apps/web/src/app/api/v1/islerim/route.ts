import { ACTION_ROLES } from "@/lib/authz";
import { handleV1Get } from "@/lib/v1-handler";
import { islerimListesiForUser } from "@/lib/domain/islerim";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleV1Get(req, ["ADMIN", "DRIVER", "FIELD_WORKER"], (session) =>
    islerimListesiForUser(session),
  );
}
