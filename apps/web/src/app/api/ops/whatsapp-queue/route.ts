import { NextResponse } from "next/server";
import { prisma } from "@kars/db";
import { ACTION_ROLES } from "@/lib/authz";
import { forbidPanelIfNot, withPanelUser } from "@/lib/panel-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await withPanelUser(req);
  if (session instanceof NextResponse) return session;

  const forbidden = forbidPanelIfNot(session.user, ACTION_ROLES.whatsapp);
  if (forbidden) return forbidden;

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
