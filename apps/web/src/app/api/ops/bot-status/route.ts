import { NextResponse } from "next/server";
import { ACTION_ROLES } from "@/lib/authz";
import { getBotStatus } from "@/lib/bot-status";
import { forbidPanelIfNot, withPanelUser } from "@/lib/panel-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await withPanelUser(req);
  if (session instanceof NextResponse) return session;

  const forbidden = forbidPanelIfNot(session.user, ACTION_ROLES.whatsapp);
  if (forbidden) return forbidden;

  return NextResponse.json(await getBotStatus());
}
