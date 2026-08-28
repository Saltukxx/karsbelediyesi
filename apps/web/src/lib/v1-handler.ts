import type { Rol } from "@kars/db";
import { withApiUser, json, badRequest, forbidIfNot } from "@/lib/api-v1";
import { apiUserToSession } from "@/lib/api-session";
import type { AppSession } from "@/lib/authz";

export async function handleV1Write(
  req: Request,
  roles: readonly Rol[],
  handler: (session: AppSession, body: Record<string, unknown>) => Promise<unknown>,
) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const forbidden = forbidIfNot(auth.user, [...roles]);
  if (forbidden) return forbidden;
  const session = apiUserToSession(auth.user);
  let body: Record<string, unknown> = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    body = {};
  }
  try {
    const result = await handler(session, body);
    return json(result ?? { ok: true });
  } catch (e) {
    return v1Error(e);
  }
}

export async function handleV1Get(
  req: Request,
  roles: readonly Rol[] | null,
  handler: (session: AppSession) => Promise<unknown>,
) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  if (roles) {
    const forbidden = forbidIfNot(auth.user, [...roles]);
    if (forbidden) return forbidden;
  }
  try {
    return json(await handler(apiUserToSession(auth.user)));
  } catch (e) {
    return v1Error(e);
  }
}

export function v1Error(e: unknown) {
  const msg = e instanceof Error ? e.message : "Hata";
  if (msg === "Yetkisiz" || msg === "Oturum gerekli") {
    return json({ error: msg }, msg === "Yetkisiz" ? 403 : 401);
  }
  return badRequest(msg);
}

export function str(body: Record<string, unknown>, key: string): string {
  const v = body[key];
  return v == null ? "" : String(v).trim();
}

export function optStr(body: Record<string, unknown>, key: string): string | undefined {
  const v = str(body, key);
  return v === "" ? undefined : v;
}

export function optNum(body: Record<string, unknown>, key: string): number | undefined {
  const v = body[key];
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

export function parseKoordinatlar(raw: unknown): [number, number][] {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Koordinat formatı geçersiz");
    }
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length < 2 ||
    !parsed.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        typeof p[0] === "number" &&
        typeof p[1] === "number" &&
        Number.isFinite(p[0]) &&
        Number.isFinite(p[1]),
    )
  ) {
    throw new Error("En az 2 geçerli koordinat gerekli");
  }
  return parsed as [number, number][];
}
