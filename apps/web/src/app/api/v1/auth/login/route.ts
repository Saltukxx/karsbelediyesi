import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@kars/db";
import { signApiToken } from "@/lib/mobile-auth";
import { checkLoginRateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const body = (await req.json()) as { phone?: string; password?: string };
  const phone = String(body.phone ?? "").replace(/\s/g, "");
  const password = String(body.password ?? "");
  if (!phone || !password) {
    return NextResponse.json({ error: "Telefon ve şifre gerekli" }, { status: 400 });
  }

  if (!checkLoginRateLimit(clientIp(req), phone)) {
    return NextResponse.json(
      { error: "Çok fazla deneme. 15 dakika sonra tekrar deneyin." },
      { status: 429 },
    );
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !user.aktif) {
    return NextResponse.json({ error: "Geçersiz kimlik bilgileri" }, { status: 401 });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Geçersiz kimlik bilgileri" }, { status: 401 });
  }

  const token = signApiToken({
    id: user.id,
    role: user.role,
    phone: user.phone,
    departmentId: user.departmentId,
  });

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      departmentId: user.departmentId,
    },
  });
}
