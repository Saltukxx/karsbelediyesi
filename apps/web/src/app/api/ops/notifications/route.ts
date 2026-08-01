import { NextResponse } from "next/server";
import { prisma } from "@kars/db";
import { withPanelUser } from "@/lib/panel-auth";
import { slaTaramasiCalistir } from "@/lib/sla-notify";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await withPanelUser(req);
  if (session instanceof NextResponse) return session;
  const userId = session.user.id;

  // Ayrı cron kurmadan SLA taraması (en fazla 10 dakikada bir çalışır)
  await slaTaramasiCalistir();

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        tip: true,
        baslik: true,
        mesaj: true,
        href: true,
        okundu: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where: { userId, okundu: false } }),
  ]);

  return NextResponse.json({
    unread,
    items: items.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
  });
}
