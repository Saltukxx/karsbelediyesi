import { prisma } from "@kars/db";
import type { SikayetDurum } from "@kars/db";
import { withApiUser, json, badRequest, forbidIfNot } from "@/lib/api-v1";
import { assertComplaintApiAccess, toAccessUser } from "@/lib/access";
import { canTransitionComplaint } from "@/lib/domain/complaint-status";
import { serializeComplaint } from "@/lib/v1-serialize";
import { auditKaydet } from "@/lib/audit";

export const dynamic = "force-dynamic";

const complaintInclude = {
  neighborhood: { select: { id: true, name: true } },
  complaintType: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  vehicle: { select: { id: true, plaka: true } },
} as const;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const forbidden = forbidIfNot(auth.user, [
    "ADMIN",
    "CALL_CENTER",
    "DEPARTMENT_MANAGER",
    "APPROVER",
  ]);
  if (forbidden) return forbidden;

  const { id } = await ctx.params;
  const access = await assertComplaintApiAccess(toAccessUser(auth.user), id);
  if (access instanceof Response) return access;

  const row = await prisma.complaint.findUnique({
    where: { id },
    include: complaintInclude,
  });
  if (!row) return json({ error: "Not found" }, 404);
  return json(serializeComplaint(row));
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const forbidden = forbidIfNot(auth.user, [
    "ADMIN",
    "CALL_CENTER",
    "DEPARTMENT_MANAGER",
    "APPROVER",
  ]);
  if (forbidden) return forbidden;

  const { id } = await ctx.params;
  const access = await assertComplaintApiAccess(toAccessUser(auth.user), id);
  if (access instanceof Response) return access;

  const body = (await req.json()) as {
    durum?: SikayetDurum;
    cozumNotu?: string;
    lat?: number;
    lng?: number;
  };

  const eski = access.row;

  if (body.durum) {
    if (!["ACIK", "DEVAM_EDIYOR", "KAPATILDI", "IPTAL"].includes(body.durum)) {
      return badRequest("Geçersiz durum");
    }
    const transition = canTransitionComplaint(eski.durum, body.durum, auth.user.role);
    if (!transition.ok) return badRequest(transition.error);
  }

  const row = await prisma.complaint.update({
    where: { id },
    data: {
      ...(body.durum
        ? {
            durum: body.durum,
            ...(body.durum === "KAPATILDI"
              ? {
                  kapanisTarihi: new Date(),
                  cozumNotu: body.cozumNotu,
                  onaylayanId: auth.user.id,
                }
              : body.cozumNotu
                ? { cozumNotu: body.cozumNotu }
                : {}),
          }
        : body.cozumNotu
          ? { cozumNotu: body.cozumNotu }
          : {}),
      ...(body.lat != null ? { lat: body.lat } : {}),
      ...(body.lng != null ? { lng: body.lng } : {}),
      ...(body.durum
        ? {
            events: {
              create: {
                userId: auth.user.id,
                tip: "DURUM_DEGISTI",
                detay: { eski: eski.durum, yeni: body.durum, kaynak: "api-v1" },
              },
            },
          }
        : {}),
    },
    include: complaintInclude,
  });

  await auditKaydet({ user: auth.user }, "SIKAYET_DURUM_GUNCELLE", {
    varlik: "Complaint",
    varlikId: id,
    detay: { eski: eski.durum, yeni: body.durum, kaynak: "api-v1" },
  });

  return json(serializeComplaint(row));
}
