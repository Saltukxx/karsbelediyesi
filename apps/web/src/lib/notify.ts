import { prisma } from "@kars/db";
import type { Rol } from "@kars/shared";
import { pushGonder } from "@/lib/push";

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
 * Anahtarı olan bildirimlerde daha önce aynı bildirimi almış kullanıcıları
 * eler. `skipDuplicates` kaç kaydın atlandığını söylemediği için, push'un
 * tekrar gitmemesi adına alıcılar önceden süzülür.
 */
async function yeniAlicilar(userIds: string[], anahtar: string): Promise<string[]> {
  const anahtarlar = userIds.map((userId) => `${anahtar}:${userId}`);
  const mevcut = await prisma.notification.findMany({
    where: { anahtar: { in: anahtarlar } },
    select: { anahtar: true },
  });
  const gonderilmis = new Set(mevcut.map((m) => m.anahtar));
  return userIds.filter((userId) => !gonderilmis.has(`${anahtar}:${userId}`));
}

/**
 * Panel içi bildirim oluşturur ve kayıtlı iOS cihazlarına push gönderir.
 * Asıl işlemi bozmamak için hata fırlatmaz.
 */
export async function bildirimGonder(
  userIds: string[],
  icerik: BildirimIcerik,
): Promise<void> {
  const benzersiz = [...new Set(userIds)].filter(Boolean);
  if (benzersiz.length === 0) return;
  try {
    const alicilar = icerik.anahtar
      ? await yeniAlicilar(benzersiz, icerik.anahtar)
      : benzersiz;
    if (alicilar.length === 0) return;

    await prisma.notification.createMany({
      data: alicilar.map((userId) => ({
        userId,
        tip: icerik.tip,
        baslik: icerik.baslik,
        mesaj: icerik.mesaj,
        href: icerik.href,
        anahtar: icerik.anahtar ? `${icerik.anahtar}:${userId}` : undefined,
      })),
      skipDuplicates: true,
    });

    await pushGonder(alicilar, {
      baslik: icerik.baslik,
      mesaj: icerik.mesaj,
      href: icerik.href,
      tip: icerik.tip,
    });
  } catch (e) {
    console.error("Bildirim oluşturulamadı:", {
      tip: icerik.tip,
      baslik: icerik.baslik,
      anahtar: icerik.anahtar,
      userIds: benzersiz,
      hata: e,
    });
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
  } catch (e) {
    console.error("Bildirim alıcıları okunamadı:", { roles, departmentId, hata: e });
    return [];
  }
}
