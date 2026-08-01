import { NextResponse } from "next/server";
import { forbidPanelIfNot, withPanelUser } from "@/lib/panel-auth";
import { sapmaTaramasi } from "@/lib/route-analysis";

export const dynamic = "force-dynamic";

/**
 * Rota dışı kalmış görevlerin taranması. Panel yenilemesinden bağımsız
 * çalışabilmesi için cron ile de tetiklenebilir:
 *   curl -X POST -H "x-cron-secret: ..." http://host/api/ops/sapma-tarama
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const gelen = req.headers.get("x-cron-secret");

  if (!secret || gelen !== secret) {
    const session = await withPanelUser(req);
    if (session instanceof NextResponse) return session;
    const forbidden = forbidPanelIfNot(session.user, ["ADMIN"]);
    if (forbidden) return forbidden;
  }

  const sonuc = await sapmaTaramasi();
  return NextResponse.json(sonuc);
}
