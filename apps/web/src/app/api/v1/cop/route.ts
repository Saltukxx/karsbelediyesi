import type { DispatchTip } from "@kars/db";
import { ACTION_ROLES } from "@/lib/authz";
import { handleV1Get, handleV1Write, str, optStr, optNum } from "@/lib/v1-handler";
import {
  sahaRotalariGetir,
  copRotaKaydetForUser,
  copToplamaKaydetForUser,
  dispatchAdaylariForUser,
  dispatchAtaForUser,
} from "@/lib/domain/map-for-user";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleV1Get(req, null, () => sahaRotalariGetir("cop"));
}

export async function POST(req: Request) {
  return handleV1Write(req, ACTION_ROLES.cop, async (session, body) => {
    const action = str(body, "action") || "route";
    if (action === "operation") {
      return copToplamaKaydetForUser(session.user, {
        routeId: str(body, "routeId"),
        vehicleId: optStr(body, "vehicleId"),
        notlar: optStr(body, "notlar"),
      });
    }
    if (action === "dispatch") {
      return dispatchAtaForUser(session.user, {
        tip: "COP" as DispatchTip,
        routeId: str(body, "routeId"),
        vehicleId: str(body, "vehicleId"),
      });
    }
    if (action === "candidates") {
      return dispatchAdaylariForUser(session.user, "COP", str(body, "routeId"));
    }
    return copRotaKaydetForUser(session.user, {
      ad: str(body, "ad"),
      koordinatlar: body.koordinatlar,
      gunler: (body.gunler as number[]) ?? [1, 2, 3, 4, 5],
      oncelik: optNum(body, "oncelik"),
      notlar: optStr(body, "notlar"),
    });
  });
}
