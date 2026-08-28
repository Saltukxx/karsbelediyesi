import { prisma } from "@kars/db";
import { trySessionOrApiUser } from "@/lib/api-session";
import { slaTaramasiCalistir } from "@/lib/sla-notify";
import { aracSuresiTaramasiCalistir } from "@/lib/vehicle-expiry-notify";
import { bildirimOkunduForUser } from "@/lib/domain/notifications";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await trySessionOrApiUser(req);
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  await slaTaramasiCalistir();
  await aracSuresiTaramasiCalistir();
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.notification.count({ where: { userId: session.user.id, okundu: false } }),
  ]);
  return NextResponse.json({
    unread,
    items: items.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
  });
}

export async function PATCH(req: Request) {
  const session = await trySessionOrApiUser(req);
  if (!session) return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  const body = (await req.json()) as { id?: string; all?: boolean };
  await bildirimOkunduForUser(session, { id: body.id, all: body.all });
  return NextResponse.json({ ok: true });
}
