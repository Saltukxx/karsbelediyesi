"use server";

import { requireSession } from "@/lib/authz";
import { bildirimOkunduForUser } from "@/lib/domain/notifications";

export async function bildirimOkunduIsaretle(id: string) {
  const session = await requireSession();
  await bildirimOkunduForUser(session, { id });
}

export async function tumBildirimleriOkunduSay() {
  const session = await requireSession();
  await bildirimOkunduForUser(session, { all: true });
}
