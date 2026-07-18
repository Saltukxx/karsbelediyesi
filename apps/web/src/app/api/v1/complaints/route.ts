import { nextComplaintSerial, prisma, withSerialRetry, type Prisma } from "@kars/db";
import type { Oncelik } from "@kars/db";
import { withApiUser, json, badRequest, forbidIfNot } from "@/lib/api-v1";
import { departmentWhere, toAccessUser } from "@/lib/access";
import { complaintCreateSchema } from "@/lib/api-schemas";
import { serializeComplaint } from "@/lib/v1-serialize";

export const dynamic = "force-dynamic";

const complaintInclude = {
  neighborhood: { select: { id: true, name: true } },
  complaintType: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  vehicle: { select: { id: true, plaka: true } },
} as const;

export async function GET(req: Request) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const forbidden = forbidIfNot(auth.user, [
    "ADMIN",
    "CALL_CENTER",
    "DEPARTMENT_MANAGER",
    "APPROVER",
  ]);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const sekme = url.searchParams.get("sekme");
  const where: Prisma.ComplaintWhereInput = {};
  if (sekme === "aktif") {
    where.durum = { in: ["ACIK", "DEVAM_EDIYOR"] };
  } else if (sekme === "kapali") {
    where.durum = { in: ["KAPATILDI", "IPTAL"] };
  }

  Object.assign(where, departmentWhere(toAccessUser(auth.user)));

  const rows = await prisma.complaint.findMany({
    where,
    include: complaintInclude,
    orderBy: { kayitTarihi: "desc" },
    take: 200,
  });

  return json(rows.map(serializeComplaint));
}

export async function POST(req: Request) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const forbidden = forbidIfNot(auth.user, [
    "ADMIN",
    "CALL_CENTER",
    "DEPARTMENT_MANAGER",
    "APPROVER",
  ]);
  if (forbidden) return forbidden;

  const parsed = complaintCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Geçersiz istek");
  }
  const body = parsed.data;

  let departmentId = body.departmentId;
  if (!departmentId && body.complaintTypeId) {
    const tur = await prisma.complaintType.findUnique({
      where: { id: body.complaintTypeId },
    });
    departmentId = tur?.defaultDepartmentId ?? undefined;
  }

  const created = await withSerialRetry(prisma, async (tx) => {
    const { yil, sira, sikayetNo } = await nextComplaintSerial(tx);
    return tx.complaint.create({
      data: {
        sikayetNo,
        yil,
        sira,
        kanal: body.kanal ?? "TELEFON",
        arayanKisi: body.arayanKisi.trim(),
        telefon: body.telefon,
        neighborhoodId: body.neighborhoodId,
        acikAdres: body.acikAdres,
        complaintTypeId: body.complaintTypeId,
        aciklama: body.aciklama,
        departmentId,
        oncelik: (body.oncelik ?? "NORMAL") as Oncelik,
        events: {
          create: {
            userId: auth.user.id,
            tip: "OLUSTURULDU",
            detay: { kanal: body.kanal ?? "TELEFON", kaynak: "api-v1" },
          },
        },
      },
      include: complaintInclude,
    });
  });

  return json(serializeComplaint(created), 201);
}
