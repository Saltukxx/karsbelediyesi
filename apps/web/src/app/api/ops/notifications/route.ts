import { NextResponse } from "next/server";
import { prisma } from "@kars/db";
import { requireSession } from "@/lib/authz";
import { slaTaramasiCalistir } from "@/lib/sla-notify";
import { aracSuresiTaramasiCalistir } from "@/lib/vehicle-expiry-notify";
import { mobilizConfigured } from "@/lib/mobiliz/client";
import { mobilizSyncCalistir } from "@/lib/mobiliz/sync";

export const dynamic = "force-dynamic";

export async function GET() {
  let userId: string;
  try {
    const session = await requireSession();
    userId = session.user.id;
  } catch {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  // Ayrı cron kurmadan SLA + araç süresi (+ Mobiliz varsa) taraması
  await slaTaramasiCalistir();
  await aracSuresiTaramasiCalistir();
  if (mobilizConfigured()) {
    void mobilizSyncCalistir();
  }

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
