import { prisma } from "@kars/db";
import { withApiUser, json, badRequest } from "@/lib/api-v1";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Mobil cihaz push token kaydı.
 * Body: { token: string, platform: "ios" | "android" }
 */
export async function POST(req: Request) {
  const auth = await withApiUser(req);
  if (auth instanceof NextResponse) return auth;

  let body: { token?: string; platform?: string };
  try {
    body = (await req.json()) as { token?: string; platform?: string };
  } catch {
    return badRequest("Geçersiz JSON");
  }

  const token = body.token?.trim();
  const platform = (body.platform?.trim() || "ios").toLowerCase();
  if (!token || token.length < 8) {
    return badRequest("token gerekli");
  }
  if (platform !== "ios" && platform !== "android") {
    return badRequest("platform ios veya android olmalı");
  }

  await prisma.deviceToken.upsert({
    where: { token },
    create: {
      userId: auth.user.id,
      token,
      platform,
    },
    update: {
      userId: auth.user.id,
      platform,
    },
  });

  return json({ ok: true });
}
