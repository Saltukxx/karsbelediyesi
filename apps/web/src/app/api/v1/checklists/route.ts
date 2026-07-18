import { prisma } from "@kars/db";
import { withApiUser, json, forbidIfNot } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const forbidden = forbidIfNot(auth.user, [
    "ADMIN",
    "DEPARTMENT_MANAGER",
    "APPROVER",
    "DRIVER",
    "FIELD_WORKER",
  ]);
  if (forbidden) return forbidden;

  const rows = await prisma.checklistSubmission.findMany({
    include: {
      template: { select: { ekipmanAdi: true } },
      operator: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return json(
    rows.map((r) => ({
      id: r.id,
      sablonAdi: r.template.ekipmanAdi,
      durum: r.durum,
      operatorAdi: r.operator?.name ?? r.sorumluOperatorTeknisyen,
      createdAt: r.createdAt.toISOString(),
    })),
  );
}
