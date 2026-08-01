import { NextResponse } from "next/server";
import type { Rol } from "@kars/shared";
import { auth } from "@/auth";
import type { AppSession, SessionUser } from "@/lib/authz";
import { requireApiUser } from "@/lib/mobile-auth";

/**
 * Panel endpoint'leri için ortak kimlik doğrulama.
 *
 * Web paneli NextAuth cookie'si ile, native iOS uygulaması `Authorization: Bearer`
 * JWT ile aynı endpoint'leri kullanır. Bearer başlığı varsa JWT yolu denenir,
 * yoksa cookie oturumuna düşülür.
 */
export async function withPanelUser(
  req?: Request,
): Promise<AppSession | NextResponse> {
  const bearer = req?.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    const user = await requireApiUser(req!);
    if (!user) return unauthorized();
    return { user: toSessionUser(user) };
  }

  const session = await auth();
  if (!session?.user?.id) return unauthorized();
  return session as AppSession;
}

export function forbidPanelIfNot(
  user: SessionUser,
  roles: readonly Rol[],
): NextResponse | null {
  if (!roles.includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  return null;
}

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
}

function toSessionUser(user: {
  id: string;
  name: string;
  phone: string;
  role: string;
  departmentId: string | null;
}): SessionUser {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role as Rol,
    departmentId: user.departmentId,
  };
}
