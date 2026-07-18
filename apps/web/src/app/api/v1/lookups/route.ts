import { prisma } from "@kars/db";
import { withApiUser, json } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;

  const [mahalleler, mudurlukler, sikayetTurleri, aracCinsleri] = await Promise.all([
    prisma.neighborhood.findMany({
      where: { aktif: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.department.findMany({
      where: { aktif: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.complaintType.findMany({
      where: { aktif: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.vehicleType.findMany({
      where: { aktif: true },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);

  return json({
    mahalleler,
    mudurlukler,
    sikayetTurleri,
    aracCinsleri: aracCinsleri.map((c) => c.name),
  });
}
