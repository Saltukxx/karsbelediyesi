import { nextComplaintSerial, prisma, withSerialRetry } from "@kars/db";
import { withApiUser, json, badRequest, forbidIfNot } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
type AiSonuc = {
  sikayet_turu?: string;
  mahalle?: string;
  adres?: string;
  aciklama_ozeti?: string;
  oncelik?: "NORMAL" | "ACIL" | "COK_ACIL";
};

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const forbidden = forbidIfNot(auth.user, ["ADMIN", "CALL_CENTER"]);
  if (forbidden) return forbidden;

  const { id } = await ctx.params;
  const body = (await req.json()) as { action?: "approve" | "reject" };
  if (body.action !== "approve" && body.action !== "reject") {
    return badRequest("action: approve | reject");
  }

  const msg = await prisma.whatsAppMessage.findUnique({ where: { id } });
  if (!msg) return json({ error: "Not found" }, 404);

  if (body.action === "reject") {
    const updated = await prisma.whatsAppMessage.update({
      where: { id },
      data: { onayDurumu: "REDDEDILDI" },
    });
    return json({
      id: updated.id,
      telefon: updated.telefon,
      yon: updated.yon,
      icerik: updated.icerik,
      onayDurumu: updated.onayDurumu,
      guven: updated.guven,
      createdAt: updated.createdAt.toISOString(),
    });
  }

  const ai = (msg.aiSonuc ?? {}) as AiSonuc;
  const [tur, mahalle] = await Promise.all([
    ai.sikayet_turu
      ? prisma.complaintType.findFirst({
          where: { name: { equals: ai.sikayet_turu, mode: "insensitive" } },
        })
      : null,
    ai.mahalle
      ? prisma.neighborhood.findFirst({
          where: { name: { equals: ai.mahalle, mode: "insensitive" } },
        })
      : null,
  ]);

  await withSerialRetry(prisma, async (tx) => {
    const { yil, sira, sikayetNo } = await nextComplaintSerial(tx);
    const created = await tx.complaint.create({
      data: {
        sikayetNo,
        yil,
        sira,
        kanal: "WHATSAPP",
        arayanKisi: msg.telefon,
        telefon: msg.telefon,
        neighborhoodId: mahalle?.id,
        acikAdres: ai.adres,
        complaintTypeId: tur?.id,
        departmentId: tur?.defaultDepartmentId,
        aciklama: ai.aciklama_ozeti ?? msg.icerik ?? "",
        oncelik: ai.oncelik ?? "NORMAL",
        durum: "ACIK",
      },
    });
    await tx.whatsAppMessage.update({
      where: { id },
      data: { onayDurumu: "ONAYLANDI", complaintId: created.id },
    });
    await tx.complaintEvent.create({
      data: {
        complaintId: created.id,
        userId: auth.user.id,
        tip: "WHATSAPP_ONAY",
        detay: { messageId: id, kaynak: "api-v1" },
      },
    });
  });

  const updated = await prisma.whatsAppMessage.findUniqueOrThrow({ where: { id } });
  return json({
    id: updated.id,
    telefon: updated.telefon,
    yon: updated.yon,
    icerik: updated.icerik,
    onayDurumu: updated.onayDurumu,
    guven: updated.guven,
    createdAt: updated.createdAt.toISOString(),
  });
}
