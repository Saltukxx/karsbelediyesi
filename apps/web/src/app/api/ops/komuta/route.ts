import { NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { komutaVerisiGetir } from "@/lib/komuta";

export const dynamic = "force-dynamic";

const IZINLI_ROLLER = ["ADMIN", "DEPARTMENT_MANAGER"];

/** Komuta ekranı canlı verisi — 30 sn'de bir istemci tarafından çekilir */
export async function GET() {
  try {
    const session = await requireSession();
    if (!IZINLI_ROLLER.includes(session.user.role)) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  const veri = await komutaVerisiGetir();
  return NextResponse.json(veri);
}
