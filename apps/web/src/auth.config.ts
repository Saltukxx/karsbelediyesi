import type { NextAuthConfig } from "next-auth";

/**
 * Edge-uyumlu (Prisma içermeyen) ortak Auth.js yapılandırması.
 * middleware.ts bunu kullanır; tam yapılandırma src/auth.ts'te.
 */
export const authConfig = {
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  // Oturum en fazla 12 saat geçerli (güvenlik sertleştirme)
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  pages: { signIn: "/giris" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.departmentId = user.departmentId;
        token.phone = user.phone;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as typeof session.user.role;
      session.user.departmentId = (token.departmentId as string | null) ?? null;
      session.user.phone = token.phone as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
