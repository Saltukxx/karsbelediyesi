import { prisma } from "@kars/db";
import { withApiUser, json, forbidIfNot } from "@/lib/api-v1";

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
