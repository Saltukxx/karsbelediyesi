import { NextResponse } from "next/server";
import { trySessionOrApiUser } from "@/lib/api-session";
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
    const session = await trySessionOrApiUser(req);
    if (!session) {
      return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    }
  }

  const sonuc = await sapmaTaramasi();
  return NextResponse.json(sonuc);
}
