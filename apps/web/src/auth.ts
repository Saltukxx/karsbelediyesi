import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@kars/db";
import type { Rol } from "@kars/db";
import { authConfig } from "./auth.config";

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
        if (!user || !user.aktif) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

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
