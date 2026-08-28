import { prisma } from "@kars/db";
import { geocodeKarsAdres } from "@kars/shared";
import { withApiUser, json, badRequest, forbidIfNot } from "@/lib/api-v1";
import { assertComplaintApiAccess, toAccessUser } from "@/lib/access";
import { canTransitionComplaint } from "@/lib/domain/complaint-status";
import { serializeComplaint } from "@/lib/v1-serialize";
import { auditKaydet } from "@/lib/audit";
import {
  cleanupComplaintPhotoFiles,
  saveComplaintPhotosFromBase64,
} from "@/lib/complaint-photos";
import { complaintPatchSchema } from "@/lib/api-schemas";

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

  const parsed = complaintPatchSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Geçersiz gövde");
  const body = parsed.data;
  const eski = access.row;

  if (body.durum) {
    const transition = canTransitionComplaint(eski.durum, body.durum, auth.user.role);
    if (!transition.ok) return badRequest(transition.error);
  }

  let geo: { lat: number; lng: number } | null = null;
  if (body.geocode) {
    const g = await geocodeKarsAdres({
      mahalle: access.row.neighborhoodId ?? undefined,
      adres: access.row.acikAdres ?? undefined,
    });
    if (g) geo = { lat: g.lat, lng: g.lng };
  }

  let cozumFotolari: string[] = [];
  if (body.durum === "KAPATILDI" && body.cozumFotolari?.length) {
    try {
      cozumFotolari = await saveComplaintPhotosFromBase64(body.cozumFotolari);
    } catch (e) {
      return badRequest(e instanceof Error ? e.message : "Fotoğraf kaydı başarısız");
    }
  }

  const personnelIds = body.personnelIds;
  try {
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
                    ...(cozumFotolari.length
                      ? {
                          photos: {
                            create: cozumFotolari.map((url) => ({ url, tip: "COZUM" as const })),
                          },
                        }
                      : {}),
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
        ...(geo ? { lat: geo.lat, lng: geo.lng } : {}),
        ...(body.departmentId !== undefined ? { departmentId: body.departmentId } : {}),
        ...(body.vehicleId !== undefined ? { vehicleId: body.vehicleId } : {}),
        ...(personnelIds
          ? {
              personel: {
                deleteMany: {},
                create: personnelIds.map((personnelId) => ({ personnelId })),
              },
            }
          : {}),
        ...(body.durum || body.lat != null || personnelIds
          ? {
              events: {
                create: {
                  userId: auth.user.id,
                  tip: body.durum ? "DURUM_DEGISTI" : "GOREVLENDIRME",
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
      detay: { eski: eski.durum, yeni: body.durum, kaynak: "api-v1", fotoAdet: cozumFotolari.length },
    });

    return json(serializeComplaint(row));
  } catch (e) {
    await cleanupComplaintPhotoFiles(cozumFotolari);
    throw e;
  }
}
