import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@kars/db";
import type { Rol } from "@kars/db";
import type { User } from "@kars/db";
import { authConfig } from "./auth.config";

/** Başarılı/başarısız giriş izi — audit bozulursa giriş akışı etkilenmez */
async function girisIziYaz(
  user: Pick<User, "id" | "name" | "role"> | null,
  phone: string,
  basarili: boolean,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: user?.id,
        userAd: user?.name ?? phone,
        rol: user?.role ?? "-",
        islem: basarili ? "GIRIS" : "GIRIS_BASARISIZ",
        detay: { telefon: phone },
      },
    });
    if (basarili && user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }
  } catch (e) {
    console.error("Giriş izi yazılamadı:", e);
  }
}

declare module "next-auth" {
  interface User {
    role: Rol;
    departmentId: string | null;
    phone: string;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      phone: string;
      role: Rol;
      departmentId: string | null;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Telefon + Şifre",
      credentials: {
        phone: { label: "Telefon", type: "text" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(credentials) {
        const phone = String(credentials?.phone ?? "").replace(/\s/g, "");
        const password = String(credentials?.password ?? "");
        if (!phone || !password) return null;

        const user = await prisma.user.findUnique({ where: { phone } });
        if (!user || !user.aktif) {
          await girisIziYaz(null, phone, false);
          return null;
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          await girisIziYaz(user, phone, false);
          return null;
        }

        await girisIziYaz(user, phone, true);

        return {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          departmentId: user.departmentId,
        };
      },
    }),
  ],
});
