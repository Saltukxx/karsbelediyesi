import { NextResponse } from "next/server";
import { trySessionOrApiUser } from "@/lib/api-session";
import { aracSuresiTaramasiCalistir } from "@/lib/vehicle-expiry-notify";

export const dynamic = "force-dynamic";

/**
 * Araç muayene / sigorta süresi taraması. Panel poll'undan bağımsız:
 *   curl -X POST -H "x-cron-secret: ..." http://host/api/ops/arac-suresi-tarama
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

  await aracSuresiTaramasiCalistir();
  return NextResponse.json({ ok: true });
}
