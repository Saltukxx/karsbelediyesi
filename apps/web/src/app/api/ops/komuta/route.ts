import { NextResponse } from "next/server";
import type { Rol } from "@kars/shared";
import { komutaFiltresi, komutaVerisiGetir } from "@/lib/komuta";
import { forbidPanelIfNot, withPanelUser } from "@/lib/panel-auth";

export const dynamic = "force-dynamic";

const IZINLI_ROLLER: Rol[] = ["ADMIN", "DEPARTMENT_MANAGER"];

/** Komuta ekranı canlı verisi — 30 sn'de bir istemci tarafından çekilir */
export async function GET(req: Request) {
  const session = await withPanelUser(req);
  if (session instanceof NextResponse) return session;

  const forbidden = forbidPanelIfNot(session.user, IZINLI_ROLLER);
  if (forbidden) return forbidden;

  const veri = await komutaVerisiGetir(komutaFiltresi(session.user));
  return NextResponse.json(veri);
}
