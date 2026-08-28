import type { DispatchTip } from "@kars/db";
import { ACTION_ROLES } from "@/lib/authz";
import { handleV1Write, str } from "@/lib/v1-handler";
import {
  dispatchAdaylariForUser,
  dispatchAtaForUser,
  dispatchReddetForUser,
} from "@/lib/domain/map-for-user";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleV1Write(req, ACTION_ROLES.dispatch, async (session, body) => {
    const action = str(body, "action");
    const tip = (str(body, "tip") || "KIS") as DispatchTip;
    if (action === "candidates") {
      return dispatchAdaylariForUser(session.user, tip, str(body, "routeId"));
    }
    if (action === "assign") {
      return dispatchAtaForUser(session.user, {
        tip,
        routeId: str(body, "routeId"),
        vehicleId: str(body, "vehicleId"),
      });
    }
    if (action === "reject") {
      return dispatchReddetForUser(session.user, str(body, "jobId"));
    }
    throw new Error("action: candidates | assign | reject");
  });
}
