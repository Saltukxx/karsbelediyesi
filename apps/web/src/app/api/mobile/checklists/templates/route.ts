import { NextResponse } from "next/server";
import { prisma } from "@kars/db";
import { requireMobileUser } from "@/lib/mobile-auth";

export async function GET(req: Request) {
  const user = await requireMobileUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await prisma.checklistTemplate.findMany({
    where: { aktif: true },
    include: {
      items: { where: { aktif: true }, orderBy: { siraNo: "asc" } },
    },
  });

  return NextResponse.json(templates);
}
