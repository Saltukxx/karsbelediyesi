import { NextResponse } from "next/server";
import { ACTION_ROLES, requireRoles } from "@/lib/authz";
import { getBotStatus } from "@/lib/bot-status";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRoles(ACTION_ROLES.whatsapp);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    const status = msg === "Yetkisiz" ? 403 : 401;
    return NextResponse.json({ error: msg }, { status });
  }

  return NextResponse.json(await getBotStatus());
}
