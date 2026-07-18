import { NextResponse } from "next/server";
import { prisma } from "@kars/db";
import { requireMobileUser } from "@/lib/mobile-auth";

export async function GET(req: Request) {
  const user = await requireMobileUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tasks = await prisma.vehicleTask.findMany({
    where: {
      durum: { in: ["PLANLANDI", "DEVAM_EDIYOR"] },
      OR: [
        { driverId: user.id },
        { vehicle: { atananSoforId: user.id } },
        ...(user.role === "ADMIN" ? [{}] : []),
      ],
    },
    orderBy: { talepTarihi: "desc" },
    include: { vehicle: { select: { id: true, plaka: true, sayacDeger: true } } },
  });

  return NextResponse.json(tasks);
}
