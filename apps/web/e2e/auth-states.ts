import path from "path";

/** Seed kullanıcıları (packages/db/prisma/seed.ts ile aynı olmalı) */
export const KULLANICILAR = {
  admin: { phone: "05000000000", password: "admin123" },
  cagriMerkezi: { phone: "05000000010", password: "cc123" },
  mudur: { phone: "05000000020", password: "mudur123" },
} as const;

export type RolAnahtari = keyof typeof KULLANICILAR;

const AUTH_DIR = path.join(__dirname, ".auth");

export const OTURUM: Record<RolAnahtari, string> = {
  admin: path.join(AUTH_DIR, "admin.json"),
  cagriMerkezi: path.join(AUTH_DIR, "cagri-merkezi.json"),
  mudur: path.join(AUTH_DIR, "mudur.json"),
};
