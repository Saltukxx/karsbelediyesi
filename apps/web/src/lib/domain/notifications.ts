import { prisma } from "@kars/db";
import type { AppSession } from "@/lib/authz";

export async function bildirimOkunduForUser(
  session: AppSession,
  input: { id?: string; all?: boolean },
) {
  if (input.all) {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, okundu: false },
      data: { okundu: true },
    });
    return { ok: true };
  }
  if (input.id) {
    await prisma.notification.updateMany({
      where: { id: input.id, userId: session.user.id },
      data: { okundu: true },
    });
  }
  return { ok: true };
}
