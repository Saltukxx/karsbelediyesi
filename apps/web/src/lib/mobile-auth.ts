import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@kars/db";

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET veya AUTH_SECRET zorunlu (production)");
    }
    return "dev-secret";
  }
  return secret;
}

const TOKEN_TTL_SEC = 60 * 60 * 24 * 7; // 7 gün

type Payload = {
  sub: string;
  role: string;
  phone: string;
  departmentId: string | null;
  exp: number;
};

function b64url(data: Buffer | string) {
  return Buffer.from(data)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function signMobileToken(user: {
  id: string;
  role: string;
  phone: string;
  departmentId: string | null;
}): string {
  const secret = jwtSecret();
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload: Payload = {
    sub: user.id,
    role: user.role,
    phone: user.phone,
    departmentId: user.departmentId,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${header}.${body}.${sig}`;
}

export function verifyMobileToken(token: string): Payload | null {
  let secret: string;
  try {
    secret = jwtSecret();
  } catch {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  const payload = JSON.parse(Buffer.from(body, "base64").toString()) as Payload;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

/** DB'den güncel role/departmentId — token claim'lerine güvenilmez */
export async function requireMobileUser(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const payload = verifyMobileToken(auth.slice(7));
  if (!payload) return null;
  return prisma.user.findFirst({
    where: { id: payload.sub, aktif: true },
  });
}

/** iOS panel + mobil API için ortak JWT kullanıcı doğrulama */
export const requireApiUser = requireMobileUser;
export const signApiToken = signMobileToken;
