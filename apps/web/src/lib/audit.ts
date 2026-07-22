import { prisma } from "@kars/db";

type AuditEk = {
  varlik?: string;
  varlikId?: string;
  detay?: Record<string, unknown>;
};

type AuditAktor = {
  user: { id: string; name: string; role: string };
};

/**
 * Denetim izi kaydı. Asıl işlemi bozmamak için hata fırlatmaz.
 * Hem panel oturumu (AppSession) hem API kullanıcısı ({ user }) ile çalışır.
 * Oturumsuz olaylar (başarısız giriş vb.) için auditKaydetAnonim kullanın.
 */
export async function auditKaydet(
  session: AuditAktor,
  islem: string,
  ek: AuditEk = {},
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        userAd: session.user.name,
        rol: session.user.role,
        islem,
        varlik: ek.varlik,
        varlikId: ek.varlikId,
        detay: ek.detay as object | undefined,
      },
    });
  } catch (e) {
    console.error("Audit kaydı yazılamadı:", e);
  }
}

/** Oturumu olmayan olaylar için (örn. başarısız giriş denemesi) */
export async function auditKaydetAnonim(
  islem: string,
  userAd: string,
  ek: AuditEk = {},
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userAd,
        rol: "-",
        islem,
        varlik: ek.varlik,
        varlikId: ek.varlikId,
        detay: ek.detay as object | undefined,
      },
    });
  } catch (e) {
    console.error("Audit kaydı yazılamadı:", e);
  }
}
