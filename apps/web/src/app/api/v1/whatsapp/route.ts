import { prisma } from "@kars/db";
import { withApiUser, json, forbidIfNot } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const forbidden = forbidIfNot(auth.user, ["ADMIN", "CALL_CENTER"]);
  if (forbidden) return forbidden;

  const rows = await prisma.whatsAppMessage.findMany({
    where: { onayDurumu: "ONAY_BEKLIYOR" },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return json(
    rows.map((m) => ({
      id: m.id,
      telefon: m.telefon,
      yon: m.yon,
      icerik: m.icerik,
      onayDurumu: m.onayDurumu,
      guven: m.guven,
      createdAt: m.createdAt.toISOString(),
    })),
  );
}
