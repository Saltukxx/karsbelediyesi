import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@kars/db";
import { signMobileToken } from "@/lib/mobile-auth";
import {
  basarisizGirisKaydet,
  clientIp,
  girisDenemeleriniSifirla,
  girisKilitliMi,
} from "@/lib/rate-limit";

export async function POST(req: Request) {
  const body = (await req.json()) as { phone?: string; password?: string };
  const phone = String(body.phone ?? "").replace(/\s/g, "");
  const password = String(body.password ?? "");
  if (!phone || !password) {
    return NextResponse.json({ error: "Telefon ve şifre gerekli" }, { status: 400 });
  }

  const ip = clientIp(req);
  if (await girisKilitliMi(ip, phone)) {
    return NextResponse.json(
      { error: "Çok fazla deneme. 15 dakika sonra tekrar deneyin." },
      { status: 429 },
    );
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !user.aktif) {
    await basarisizGirisKaydet(ip, phone);
    return NextResponse.json({ error: "Geçersiz kimlik bilgileri" }, { status: 401 });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    await basarisizGirisKaydet(ip, phone);
    return NextResponse.json({ error: "Geçersiz kimlik bilgileri" }, { status: 401 });
  }
  await girisDenemeleriniSifirla(ip, phone);

  const token = signMobileToken({
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
