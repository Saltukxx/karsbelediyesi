import { ACTION_ROLES } from "@/lib/authz";
import { handleV1Get, handleV1Write, str, optStr, optNum } from "@/lib/v1-handler";
import {
  mapVerisiForUser,
  asfaltYolKaydetForUser,
  asfaltYolGuncelleForUser,
  asfaltYolSilForUser,
  engelKaydetForUser,
  engelDurumGuncelleForUser,
  engelSilForUser,
} from "@/lib/domain/map";
import type { AsfaltDurum, HazardDurum, HazardTip } from "@kars/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleV1Get(req, null, (session) => mapVerisiForUser(session));
}

export async function POST(req: Request) {
  return handleV1Write(req, ACTION_ROLES.harita, async (session, body) => {
    const kind = str(body, "kind");
    if (kind === "hazard") {
      return engelKaydetForUser(session, {
        tip: optStr(body, "tip") as HazardTip | undefined,
        lat: optNum(body, "lat") ?? 0,
        lng: optNum(body, "lng") ?? 0,
        aciklama: optStr(body, "aciklama"),
        fotolar: body.fotolar as never,
      });
    }
    return asfaltYolKaydetForUser(session, {
      ad: str(body, "ad"),
      koordinatlar: body.koordinatlar,
      departmentId: optStr(body, "departmentId"),
      durum: optStr(body, "durum") as AsfaltDurum | undefined,
      notlar: optStr(body, "notlar"),
      personnelIds: body.personnelIds as string[] | undefined,
    });
  });
}

export async function PATCH(req: Request) {
  return handleV1Write(req, ACTION_ROLES.harita, async (session, body) => {
    const kind = str(body, "kind");
    const id = str(body, "id");
    if (kind === "hazard") {
      return engelDurumGuncelleForUser(session, {
        id,
        durum: str(body, "durum") as HazardDurum,
      });
    }
    return asfaltYolGuncelleForUser(session, {
      id,
      ad: str(body, "ad"),
      koordinatlar: body.koordinatlar,
      departmentId: optStr(body, "departmentId"),
      durum: optStr(body, "durum") as AsfaltDurum | undefined,
      notlar: optStr(body, "notlar"),
    });
  });
}

export async function DELETE(req: Request) {
  return handleV1Write(req, ACTION_ROLES.harita, (session, body) => {
    const id = str(body, "id");
    if (str(body, "kind") === "hazard") return engelSilForUser(session, id);
    return asfaltYolSilForUser(session, id);
  });
}
