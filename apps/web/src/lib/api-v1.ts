import { NextResponse } from "next/server";
import type { Rol, User } from "@kars/db";
import { requireApiUser } from "@/lib/mobile-auth";

export type ApiUser = User;

export async function withApiUser(
  req: Request,
): Promise<{ user: ApiUser } | NextResponse> {
  const user = await requireApiUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { user };
}

export function forbidIfNot(
  user: ApiUser,
  roles: Rol[],
): NextResponse | null {
  if (!roles.includes(user.role as Rol)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export const DEFAULT_LIST_LIMIT = 200;
export const MAX_LIST_LIMIT = 2000;

/**
 * Liste uçlarının satır sayısı. İstemci `?limit=` ile daha fazlasını isteyebilir,
 * üst sınır sabit: sınırsız `findMany` tablo büyüdükçe yanıtı da büyütüyordu.
 */
export function listLimit(req: Request, fallback = DEFAULT_LIST_LIMIT): number {
  const raw = new URL(req.url).searchParams.get("limit");
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, MAX_LIST_LIMIT);
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function catchDomain(e: unknown) {
  const msg = e instanceof Error ? e.message : "Hata";
  if (msg === "Yetkisiz") return json({ error: msg }, 403);
  if (msg === "Oturum gerekli") return json({ error: msg }, 401);
  return badRequest(msg);
}

export function assertApiRoles(user: ApiUser, roles: readonly Rol[]) {
  if (!roles.includes(user.role as Rol)) {
    throw new Error("Yetkisiz");
  }
}
