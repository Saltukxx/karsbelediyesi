import { prisma } from "@kars/db";
import { ACTION_ROLES } from "@/lib/authz";
import { handleV1Get, handleV1Write, str, optStr } from "@/lib/v1-handler";
import {
  kontrolKalemKaydetForUser,
  kontrolFormuOnayaGonderForUser,
  kontrolFormuOnaylaForUser,
  type ChecklistPeriyot,
  type ChecklistSonuc,
} from "@/lib/domain/checklists";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return handleV1Get(req, ACTION_ROLES.checklists, async () => {
    const row = await prisma.checklistSubmission.findUnique({
      where: { id },
      include: {
        template: { include: { items: { orderBy: { siraNo: "asc" } } } },
        results: true,
        operator: { select: { name: true } },
        vehicle: { select: { id: true, plaka: true } },
      },
    });
    if (!row) throw new Error("Kayıt bulunamadı");
    return {
      id: row.id,
      durum: row.durum,
      ay: row.ay,
      yilDonem: row.yilDonem,
      sablonAdi: row.template.ekipmanAdi,
      vehicle: row.vehicle,
      operatorAdi: row.operator?.name ?? row.sorumluOperatorTeknisyen,
      items: row.template.items.map((item) => ({
        id: item.id,
        kontrolKalemi: item.kontrolKalemi,
        results: row.results.filter((r) => r.templateItemId === item.id),
      })),
    };
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return handleV1Write(req, ACTION_ROLES.checklists, async (session, body) => {
    const action = str(body, "action");
    if (action === "item") {
      return kontrolKalemKaydetForUser({
        submissionId: id,
        templateItemId: str(body, "templateItemId"),
        periyot: str(body, "periyot") as ChecklistPeriyot,
        sonuc: str(body, "sonuc") as ChecklistSonuc,
        aciklamaNot: optStr(body, "aciklamaNot"),
      });
    }
    if (action === "submit") {
      return kontrolFormuOnayaGonderForUser(session, {
        id,
        teknisyenAdi: optStr(body, "teknisyenAdi"),
        sefAmirAdi: optStr(body, "sefAmirAdi"),
      });
    }
    if (action === "approve" || action === "reject") {
      return kontrolFormuOnaylaForUser(session, {
        id,
        karar: action === "approve" ? "ONAYLANDI" : "REDDEDILDI",
        sefAmirAdi: optStr(body, "sefAmirAdi"),
      });
    }
    throw new Error("action: item | submit | approve | reject");
  });
}
