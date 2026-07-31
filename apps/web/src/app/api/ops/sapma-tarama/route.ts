import { NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
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
    try {
      const session = await requireSession();
      if (session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
    }
  }

  const sonuc = await sapmaTaramasi();
  return NextResponse.json(sonuc);
}
