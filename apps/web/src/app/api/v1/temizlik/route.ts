import type { DispatchTip, TemizlikOperasyonTip } from "@kars/db";
import { ACTION_ROLES } from "@/lib/authz";
import { handleV1Get, handleV1Write, str, optStr, optNum } from "@/lib/v1-handler";
import {
  sahaRotalariGetir,
  temizlikRotaKaydetForUser,
  temizlikOperasyonKaydetForUser,
  dispatchAdaylariForUser,
  dispatchAtaForUser,
} from "@/lib/domain/map-for-user";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleV1Get(req, null, () => sahaRotalariGetir("temizlik"));
}

export async function POST(req: Request) {
  return handleV1Write(req, ACTION_ROLES.temizlik, async (session, body) => {
    const action = str(body, "action") || "route";
    if (action === "operation") {
      return temizlikOperasyonKaydetForUser(session.user, {
        routeId: str(body, "routeId"),
        tip: optStr(body, "tip") as TemizlikOperasyonTip | undefined,
        vehicleId: optStr(body, "vehicleId"),
        notlar: optStr(body, "notlar"),
      });
    }
    if (action === "dispatch") {
      return dispatchAtaForUser(session.user, {
        tip: "TEMIZLIK" as DispatchTip,
        routeId: str(body, "routeId"),
        vehicleId: str(body, "vehicleId"),
      });
    }
    if (action === "candidates") {
      return dispatchAdaylariForUser(session.user, "TEMIZLIK", str(body, "routeId"));
    }
    return temizlikRotaKaydetForUser(session.user, {
      ad: str(body, "ad"),
      koordinatlar: body.koordinatlar,
      oncelik: optNum(body, "oncelik"),
      notlar: optStr(body, "notlar"),
    });
  });
}
