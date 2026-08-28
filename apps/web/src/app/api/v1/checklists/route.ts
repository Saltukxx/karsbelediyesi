import { prisma } from "@kars/db";
import { withApiUser, json, forbidIfNot, listLimit } from "@/lib/api-v1";
import { ACTION_ROLES } from "@/lib/authz";
import { handleV1Write, str, optStr, optNum } from "@/lib/v1-handler";
import { kontrolFormuOlusturForUser } from "@/lib/domain/checklists";

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
    take: listLimit(req, 100),
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

export async function POST(req: Request) {
  return handleV1Write(req, ACTION_ROLES.checklists, (session, body) =>
    kontrolFormuOlusturForUser(session, {
      templateId: str(body, "templateId"),
      vehicleId: str(body, "vehicleId"),
      ay: optNum(body, "ay") ?? new Date().getMonth() + 1,
      yilDonem: optNum(body, "yilDonem") ?? new Date().getFullYear(),
      sorumluOperatorTeknisyen: optStr(body, "sorumluOperatorTeknisyen"),
      santiyeLokasyon: optStr(body, "santiyeLokasyon"),
    }),
  );
}
