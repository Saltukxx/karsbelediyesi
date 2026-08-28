import { NextResponse } from "next/server";
import { prisma } from "@kars/db";
import { trySessionOrApiUser } from "@/lib/api-session";
import { slaTaramasiCalistir } from "@/lib/sla-notify";
import { aracSuresiTaramasiCalistir } from "@/lib/vehicle-expiry-notify";
import { mobilizConfigured } from "@/lib/mobiliz/client";
import { mobilizSyncCalistir } from "@/lib/mobiliz/sync";
import { bildirimOkunduForUser } from "@/lib/domain/notifications";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await trySessionOrApiUser(req);
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  const userId = session.user.id;

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

export async function PATCH(req: Request) {
  const session = await trySessionOrApiUser(req);
  if (!session) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  const body = (await req.json()) as { id?: string; all?: boolean };
  if (!body.all && !body.id) {
    return NextResponse.json({ error: "id veya all gerekli" }, { status: 400 });
  }
  await bildirimOkunduForUser(session, { id: body.id, all: body.all });
  return NextResponse.json({ ok: true });
}
