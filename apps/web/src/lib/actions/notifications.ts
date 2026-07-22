"use server";

import { prisma } from "@kars/db";
import { requireSession } from "@/lib/authz";

/** Tek bildirimi okundu işaretler (sadece kendi bildirimi) */
export async function bildirimOkunduIsaretle(id: string) {
  const session = await requireSession();
  await prisma.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { okundu: true },
  });
}

/** Kullanıcının tüm bildirimlerini okundu sayar */
export async function tumBildirimleriOkunduSay() {
  const session = await requireSession();
  await prisma.notification.updateMany({
    where: { userId: session.user.id, okundu: false },
    data: { okundu: true },
  });
}
