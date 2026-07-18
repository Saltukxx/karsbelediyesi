import { NextResponse } from "next/server";
import type { Prisma } from "@kars/db";
import { prisma } from "@kars/db";
import { departmentWhere } from "@/lib/access";
import { requireMobileUser } from "@/lib/mobile-auth";

export async function GET(req: Request) {
  const user = await requireMobileUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const personnel = await prisma.personnel.findFirst({ where: { userId: user.id } });
  const where: Prisma.ComplaintWhereInput = {
    durum: { in: ["ACIK", "DEVAM_EDIYOR"] },
  };

  if (user.role === "ADMIN" || user.role === "CALL_CENTER" || user.role === "APPROVER") {
    // org-wide open complaints
  } else if (user.role === "DEPARTMENT_MANAGER") {
    Object.assign(where, departmentWhere(user));
  } else {
    where.OR = [
      ...(personnel ? [{ personel: { some: { personnelId: personnel.id } } }] : []),
      { vehicle: { atananSoforId: user.id } },
    ];
    if (!where.OR.length) {
      return NextResponse.json([]);
    }
  }

  const complaints = await prisma.complaint.findMany({
    where,
    orderBy: { kayitTarihi: "desc" },
    take: 50,
    include: {
      neighborhood: true,
      complaintType: true,
    },
  });

  return NextResponse.json(complaints);
}
