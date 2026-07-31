import { NextResponse } from "next/server";
import { requireSession, type AppSession } from "@/lib/authz";
import { komutaFiltresi, komutaVerisiGetir } from "@/lib/komuta";

export const dynamic = "force-dynamic";

const IZINLI_ROLLER = ["ADMIN", "DEPARTMENT_MANAGER"];

/** Komuta ekranı canlı verisi — 30 sn'de bir istemci tarafından çekilir */
export async function GET() {
  let session: AppSession;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  if (!IZINLI_ROLLER.includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const veri = await komutaVerisiGetir(komutaFiltresi(session.user));
  return NextResponse.json(veri);
}
