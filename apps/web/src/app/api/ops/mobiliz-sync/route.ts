import { NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { testMobilizConnection } from "@/lib/mobiliz/client";
import {
  getMobilizSyncStatus,
  mobilizSyncCalistir,
} from "@/lib/mobiliz/sync";

export const dynamic = "force-dynamic";

/**
 * Mobiliz konum sync.
 * Cron: POST -H "x-cron-secret: ..." /api/ops/mobiliz-sync
 * Admin panel: aynı endpoint veya GET ile durum.
 */
export async function GET() {
  try {
    const session = await requireSession();
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  return NextResponse.json(getMobilizSyncStatus());
}

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const gelen = req.headers.get("x-cron-secret");
  const testOnly = new URL(req.url).searchParams.get("test") === "1";

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

  if (testOnly) {
    const test = await testMobilizConnection();
    return NextResponse.json(test);
  }

  const sonuc = await mobilizSyncCalistir({ force: true });
  return NextResponse.json(sonuc);
}
