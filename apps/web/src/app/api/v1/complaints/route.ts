import { prisma, type Prisma } from "@kars/db";
import { departmentWhere, toAccessUser } from "@/lib/access";
import { created, ok, panelRoute, readJson } from "@/lib/api-route";
import { complaintInclude, serializeComplaint } from "@/lib/api/complaint-dto";
import { ACTION_ROLES } from "@/lib/authz";
import { rolGerekli } from "@/lib/services/base";
import { sikayetOlustur } from "@/lib/services/complaints";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return panelRoute(req, async (actor) => {
    rolGerekli(actor, ACTION_ROLES.complaints);

    const url = new URL(req.url);
    const sekme = url.searchParams.get("sekme");
    const where: Prisma.ComplaintWhereInput = {};
    if (sekme === "aktif") {
      where.durum = { in: ["ACIK", "DEVAM_EDIYOR"] };
    } else if (sekme === "kapali") {
      where.durum = { in: ["KAPATILDI", "IPTAL"] };
    }

    Object.assign(where, departmentWhere(toAccessUser(actor.user)));

    const rows = await prisma.complaint.findMany({
      where,
      include: complaintInclude,
      orderBy: { kayitTarihi: "desc" },
      take: 200,
    });

    return ok(rows.map(serializeComplaint));
  });
}

/**
 * Şikayet oluşturma. Web formu ile aynı servisi kullanır: tür→müdürlük
 * eşlemesi, araç zimmetinden şoför kopyalama ve personel/araç ataması dahil.
 */
export async function POST(req: Request) {
  return panelRoute(req, async (actor) => {
    const sikayet = await sikayetOlustur(actor, await readJson(req));
    const row = await prisma.complaint.findUniqueOrThrow({
      where: { id: sikayet.id },
      include: complaintInclude,
    });
    return created(serializeComplaint(row));
  });
}
