import { prisma } from "@kars/db";
import { withApiUser, json, forbidIfNot } from "@/lib/api-v1";
import { ACTION_ROLES } from "@/lib/authz";
import { handleV1Write, str, optStr } from "@/lib/v1-handler";
import {
  mahalleOlusturForUser,
  mudurlukOlusturForUser,
  sikayetTuruOlusturForUser,
} from "@/lib/domain/crud-for-user";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const forbidden = forbidIfNot(auth.user, ["ADMIN"]);
  if (forbidden) return forbidden;

  const [departments, neighborhoods, complaintTypes, vehicleTypes] = await Promise.all([
    prisma.department.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.neighborhood.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.complaintType.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.vehicleType.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return json({ departments, neighborhoods, complaintTypes, vehicleTypes });
}

export async function POST(req: Request) {
  return handleV1Write(req, ACTION_ROLES.definitions, (session, body) => {
    const kind = str(body, "kind");
    if (kind === "department") return mudurlukOlusturForUser(session.user, { name: str(body, "name") });
    if (kind === "complaintType") {
      return sikayetTuruOlusturForUser(session.user, {
        name: str(body, "name"),
        defaultDepartmentId: optStr(body, "defaultDepartmentId"),
      });
    }
    return mahalleOlusturForUser(session.user, { name: str(body, "name") });
  });
}
