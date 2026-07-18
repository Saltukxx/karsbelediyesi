import { nextTaskSerial, prisma, withSerialRetry } from "@kars/db";
import { withApiUser, json, badRequest, forbidIfNot } from "@/lib/api-v1";
import { toAccessUser } from "@/lib/access";

export const dynamic = "force-dynamic";

function serializeTask(t: {
  id: string;
  gorevNo: string;
  durum: string;
  talepTarihi: Date;
  cikisTarihi: Date | null;
  girisTarihi: Date | null;
  gorevTanimi: string | null;
  vehicleId: string;
  driverId: string | null;
  talepEdenDepartmentId: string | null;
  vehicle: { id: string; plaka: string };
}) {
  return {
    id: t.id,
    gorevNo: t.gorevNo,
    durum: t.durum,
    talepTarihi: t.talepTarihi.toISOString(),
    baslangicTarihi: t.cikisTarihi?.toISOString() ?? null,
    bitisTarihi: t.girisTarihi?.toISOString() ?? null,
    aciklama: t.gorevTanimi,
    vehicleId: t.vehicleId,
    vehicle: { id: t.vehicle.id, plaka: t.vehicle.plaka },
    driverId: t.driverId,
    talepEdenDepartmentId: t.talepEdenDepartmentId,
  };
}

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

  const user = toAccessUser(auth.user);
  const where =
    user.role === "DRIVER" || user.role === "FIELD_WORKER"
      ? { driverId: user.id }
      : user.role === "DEPARTMENT_MANAGER" && user.departmentId
        ? {
            OR: [
              { talepEdenDepartmentId: user.departmentId },
              { vehicle: { departmentId: user.departmentId } },
            ],
          }
        : {};

  const rows = await prisma.vehicleTask.findMany({
    where,
    include: { vehicle: { select: { id: true, plaka: true } } },
    orderBy: { talepTarihi: "desc" },
    take: 200,
  });

  return json(rows.map(serializeTask));
}

export async function POST(req: Request) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;
  const forbidden = forbidIfNot(auth.user, [
    "ADMIN",
    "DEPARTMENT_MANAGER",
    "APPROVER",
  ]);
  if (forbidden) return forbidden;

  const body = (await req.json()) as {
    vehicleId?: string;
    gorevTanimi?: string;
    gorevYeri?: string;
    talepEdenDepartmentId?: string;
    driverId?: string;
  };
  if (!body.vehicleId) return badRequest("vehicleId zorunlu");

  const arac = await prisma.vehicle.findUnique({
    where: { id: body.vehicleId },
  });
  if (!arac) return badRequest("Araç bulunamadı");

  const created = await withSerialRetry(prisma, async (tx) => {
    const { yil, sira, gorevNo } = await nextTaskSerial(tx);
    return tx.vehicleTask.create({
      data: {
        gorevNo,
        yil,
        sira,
        vehicleId: body.vehicleId!,
        gorevTanimi: body.gorevTanimi,
        gorevYeri: body.gorevYeri,
        talepEdenDepartmentId: body.talepEdenDepartmentId,
        driverId: body.driverId ?? arac.atananSoforId ?? undefined,
        durum: "PLANLANDI",
      },
      include: { vehicle: { select: { id: true, plaka: true } } },
    });
  });

  return json(serializeTask(created), 201);
}
