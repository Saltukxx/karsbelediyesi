import type { DispatchTip, KisOperasyonTip, KisRotaTip } from "@kars/db";
import { ACTION_ROLES } from "@/lib/authz";
import { handleV1Get, handleV1Write, str, optStr, optNum } from "@/lib/v1-handler";
import {
  sahaRotalariGetir,
  kisRotaKaydetForUser,
  kisOperasyonKaydetForUser,
  dispatchAdaylariForUser,
  dispatchAtaForUser,
} from "@/lib/domain/map-for-user";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleV1Get(req, null, () => sahaRotalariGetir("kis"));
}

export async function POST(req: Request) {
  return handleV1Write(req, ACTION_ROLES.kis, async (session, body) => {
    const action = str(body, "action") || "route";
    if (action === "operation") {
      return kisOperasyonKaydetForUser(session.user, {
        routeId: str(body, "routeId"),
        tip: optStr(body, "tip") as KisOperasyonTip | undefined,
        vehicleId: optStr(body, "vehicleId"),
        notlar: optStr(body, "notlar"),
      });
    }
    if (action === "dispatch") {
      return dispatchAtaForUser(session.user, {
        tip: "KIS" as DispatchTip,
        routeId: str(body, "routeId"),
        vehicleId: str(body, "vehicleId"),
      });
    }
    if (action === "candidates") {
      return dispatchAdaylariForUser(session.user, "KIS", str(body, "routeId"));
    }
    return kisRotaKaydetForUser(session.user, {
      ad: str(body, "ad"),
      koordinatlar: body.koordinatlar,
      tip: optStr(body, "tip") as KisRotaTip | undefined,
      oncelik: optNum(body, "oncelik"),
      notlar: optStr(body, "notlar"),
    });
  });
}
