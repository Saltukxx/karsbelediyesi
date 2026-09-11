import { NextResponse } from "next/server";
import { trySessionOrApiUser } from "@/lib/api-session";
import { slaTaramasiCalistir } from "@/lib/sla-notify";

export const dynamic = "force-dynamic";

/**
 * SLA bildirim taraması. Panel poll'undan bağımsız; cron ile tetiklenir:
 *   curl -X POST -H "x-cron-secret: ..." http://host/api/ops/sla-tarama
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const gelen = req.headers.get("x-cron-secret");

  if (!secret || gelen !== secret) {
    const session = await trySessionOrApiUser(req);
    if (!session) {
      return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    }
  }

  await slaTaramasiCalistir();
  return NextResponse.json({ ok: true });
}
