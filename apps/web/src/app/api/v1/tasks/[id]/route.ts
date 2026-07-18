import { prisma } from "@kars/db";
import { gorevSuresiSaatTarihli, kmFarki } from "@kars/shared";
import { withApiUser, json, badRequest, forbidIfNot } from "@/lib/api-v1";
import { assertTaskApiAccess, toAccessUser } from "@/lib/access";
import { canTransitionTask, validateKmPair } from "@/lib/domain/task-status";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function serialize(updated: {
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
    id: updated.id,
    gorevNo: updated.gorevNo,
    durum: updated.durum,
    talepTarihi: updated.talepTarihi.toISOString(),
    baslangicTarihi: updated.cikisTarihi?.toISOString() ?? null,
    bitisTarihi: updated.girisTarihi?.toISOString() ?? null,
    aciklama: updated.gorevTanimi,
    vehicleId: updated.vehicleId,
    vehicle: updated.vehicle,
    driverId: updated.driverId,
    talepEdenDepartmentId: updated.talepEdenDepartmentId,
  };
}

export async function PATCH(req: Request, ctx: Ctx) {
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

  const { id } = await ctx.params;
  const access = await assertTaskApiAccess(toAccessUser(auth.user), id);
  if (access instanceof Response) return access;

  const body = (await req.json()) as {
    action?: "start" | "close";
    kmSayacCikis?: number;
    kmSayacGiris?: number;
  };

  const gorev = access.row;

  if (body.action === "start") {
    const transition = canTransitionTask(gorev.durum, "DEVAM_EDIYOR");
    if (!transition.ok) return badRequest(transition.error);

    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.vehicleTask.update({
        where: { id },
        data: {
          durum: "DEVAM_EDIYOR",
          cikisTarihi: gorev.cikisTarihi ?? new Date(),
          kmSayacCikis: body.kmSayacCikis ?? gorev.kmSayacCikis,
        },
        include: { vehicle: { select: { id: true, plaka: true } } },
      });
      await tx.vehicle.update({
        where: { id: gorev.vehicleId },
        data: { operasyonDurumu: "GOREVDE", sonCikisTarihi: new Date() },
      });
      return t;
    });
    return json(serialize(updated));
  }

  if (body.action === "close") {
    const transition = canTransitionTask(gorev.durum, "TAMAMLANDI");
    if (!transition.ok) return badRequest(transition.error);

    const kmGiris = body.kmSayacGiris;
    const kmCheck = validateKmPair(gorev.kmSayacCikis ?? body.kmSayacCikis, kmGiris);
    if (!kmCheck.ok) return badRequest(kmCheck.error);

    const giris = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.vehicleTask.update({
        where: { id },
        data: {
          durum: "TAMAMLANDI",
          girisTarihi: giris,
          sureSaat:
            gorev.cikisTarihi != null
              ? gorevSuresiSaatTarihli(gorev.cikisTarihi, giris)
              : gorev.sureSaat,
          kmSayacGiris: kmGiris ?? gorev.kmSayacGiris,
          kmFarki:
            gorev.kmSayacCikis != null && kmGiris != null
              ? kmFarki(gorev.kmSayacCikis, kmGiris)
              : gorev.kmFarki,
        },
        include: { vehicle: { select: { id: true, plaka: true } } },
      });
      const otherActive = await tx.vehicleTask.count({
        where: {
          vehicleId: gorev.vehicleId,
          durum: "DEVAM_EDIYOR",
          id: { not: id },
        },
      });
      if (otherActive === 0) {
        await tx.vehicle.update({
          where: { id: gorev.vehicleId },
          data: { operasyonDurumu: "MUSAIT" },
        });
      }
      return t;
    });
    return json(serialize(updated));
  }

  return badRequest("action: start | close");
}
