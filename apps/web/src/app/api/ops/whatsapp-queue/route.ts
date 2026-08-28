import { NextResponse } from "next/server";
import { prisma } from "@kars/db";
import { ACTION_ROLES } from "@/lib/authz";
import { requireRolesOrApi } from "@/lib/api-session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireRolesOrApi(req, ACTION_ROLES.whatsapp);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    const status = msg === "Yetkisiz" ? 403 : 401;
    return NextResponse.json({ error: msg }, { status });
  }

  const [pendingCount, pending] = await Promise.all([
    prisma.whatsAppMessage.count({
      where: { onayDurumu: "ONAY_BEKLIYOR", yon: "GELEN" },
    }),
    prisma.whatsAppMessage.findMany({
      where: { onayDurumu: "ONAY_BEKLIYOR", yon: "GELEN" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        telefon: true,
        icerik: true,
        guven: true,
        createdAt: true,
        onayDurumu: true,
      },
    }),
  ]);

  return NextResponse.json({
    pendingCount,
    pending: pending.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
    fetchedAt: new Date().toISOString(),
  });
}
