import { prisma } from "@kars/db";
import { ACTION_ROLES } from "@/lib/authz";
import { handleV1Get } from "@/lib/v1-handler";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleV1Get(req, ACTION_ROLES.checklists, async () => {
    const rows = await prisma.checklistTemplate.findMany({
      where: { aktif: true },
      orderBy: { ekipmanAdi: "asc" },
      select: { id: true, ekipmanAdi: true },
    });
    return rows.map((r) => ({ id: r.id, name: r.ekipmanAdi }));
  });
}
