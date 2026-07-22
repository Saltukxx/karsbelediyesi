import { NextResponse } from "next/server";
import { prisma } from "@kars/db";
import { requireSession } from "@/lib/authz";
import { slaTaramasiCalistir } from "@/lib/sla-notify";

export const dynamic = "force-dynamic";

export async function GET() {
  let userId: string;
  try {
    const session = await requireSession();
    userId = session.user.id;
  } catch {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

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
