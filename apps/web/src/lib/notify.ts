import { prisma } from "@kars/db";
import type { Rol } from "@kars/shared";

export type BildirimTip = "ATAMA" | "GOREV" | "ONAY" | "SLA" | "SISTEM";

type BildirimIcerik = {
  tip: BildirimTip;
  baslik: string;
  mesaj?: string;
  href?: string;
  /** Verilirse aynı anahtarla ikinci bildirim oluşturulmaz (kullanıcı başına benzersizleştirilir) */
  anahtar?: string;
};

/**
 * Panel içi bildirim oluşturur. Asıl işlemi bozmamak için hata fırlatmaz.
 */
export async function bildirimGonder(
  userIds: string[],
  icerik: BildirimIcerik,
): Promise<void> {
  const benzersiz = [...new Set(userIds)].filter(Boolean);
  if (benzersiz.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: benzersiz.map((userId) => ({
        userId,
        tip: icerik.tip,
        baslik: icerik.baslik,
        mesaj: icerik.mesaj,
        href: icerik.href,
        anahtar: icerik.anahtar ? `${icerik.anahtar}:${userId}` : undefined,
      })),
      skipDuplicates: true,
    });
  } catch (e) {
    console.error("Bildirim oluşturulamadı:", e);
  }
}

/** Role (ve isteğe bağlı müdürlüğe) göre aktif kullanıcı id'leri */
export async function kullaniciIdleri(
  roles: Rol[],
  departmentId?: string | null,
): Promise<string[]> {
  try {
    const users = await prisma.user.findMany({
      where: {
        aktif: true,
        role: { in: roles },
        ...(departmentId ? { departmentId } : {}),
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
  } catch {
    return [];
  }
}
