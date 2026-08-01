import { prisma } from "@kars/db";
import { toAccessUser } from "@/lib/access";
import { created, ok, panelRoute, readJson } from "@/lib/api-route";
import { ACTION_ROLES } from "@/lib/authz";
import { rolGerekli } from "@/lib/services/base";
import { gorevOlustur } from "@/lib/services/tasks";

export const dynamic = "force-dynamic";

type TaskDispatchJob = {
  tip: "KIS" | "COP" | "TEMIZLIK";
  routeId: string;
  rota: unknown;
  mesafeKm: number | null;
  sureDk: number | null;
  tahmini: boolean;
} | null;

interface RotaAlani {
  /** Araç konumu → iş başlangıcı (OSRM) [[lat,lng], ...] */
  gidis: [number, number][] | null;
  /** Servis rotası (küreme/toplama güzergahı) [[lat,lng], ...] */
  servis: [number, number][] | null;
  mesafeKm: number | null;
  sureDk: number | null;
  tahmini: boolean;
}

function serializeTask(
  t: {
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
    dispatchJob?: TaskDispatchJob;
  },
  servisKoordinatlari?: Map<string, [number, number][]>,
) {
  let rota: RotaAlani | null = null;
  if (t.dispatchJob) {
    rota = {
      gidis: (t.dispatchJob.rota as [number, number][] | null) ?? null,
      servis: servisKoordinatlari?.get(t.dispatchJob.routeId) ?? null,
      mesafeKm: t.dispatchJob.mesafeKm,
      sureDk: t.dispatchJob.sureDk,
      tahmini: t.dispatchJob.tahmini,
    };
  }
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
    rota,
  };
}

/** Dispatch'li görevlerin servis rotası koordinatları (routeId → [[lat,lng]]) */
async function servisRotalari(
  jobs: Array<NonNullable<TaskDispatchJob>>,
): Promise<Map<string, [number, number][]>> {
  const sonuc = new Map<string, [number, number][]>();
  const kisIds = [...new Set(jobs.filter((j) => j.tip === "KIS").map((j) => j.routeId))];
  const copIds = [...new Set(jobs.filter((j) => j.tip === "COP").map((j) => j.routeId))];
  const temizlikIds = [
    ...new Set(jobs.filter((j) => j.tip === "TEMIZLIK").map((j) => j.routeId)),
  ];
  const [kisRotalar, copRotalar, temizlikRotalar] = await Promise.all([
    kisIds.length > 0
      ? prisma.winterRoute.findMany({
          where: { id: { in: kisIds } },
          select: { id: true, koordinatlar: true },
        })
      : Promise.resolve([]),
    copIds.length > 0
      ? prisma.wasteRoute.findMany({
          where: { id: { in: copIds } },
          select: { id: true, koordinatlar: true },
        })
      : Promise.resolve([]),
    temizlikIds.length > 0
      ? prisma.cleaningRoute.findMany({
          where: { id: { in: temizlikIds } },
          select: { id: true, koordinatlar: true },
        })
      : Promise.resolve([]),
  ]);
  for (const r of [...kisRotalar, ...copRotalar, ...temizlikRotalar]) {
    sonuc.set(r.id, r.koordinatlar as [number, number][]);
  }
  return sonuc;
}

export async function GET(req: Request) {
  return panelRoute(req, async (actor) => {
    rolGerekli(actor, ACTION_ROLES.tasks);

    const user = toAccessUser(actor.user);
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
      include: {
        vehicle: { select: { id: true, plaka: true } },
        dispatchJob: {
          select: {
            tip: true,
            routeId: true,
            rota: true,
            mesafeKm: true,
            sureDk: true,
            tahmini: true,
          },
        },
      },
      orderBy: { talepTarihi: "desc" },
      take: 200,
    });

    const servisler = await servisRotalari(
      rows.map((r) => r.dispatchJob).filter((j): j is NonNullable<typeof j> => j != null),
    );

    return ok(rows.map((r) => serializeTask(r, servisler)));
  });
}

/**
 * Görev oluşturma — web formuyla aynı tam alan seti (tarihler, KM, maliyet,
 * durum, onaylayan). Görev No serisi ve araç durumu servis tarafında yönetilir.
 */
export async function POST(req: Request) {
  return panelRoute(req, async (actor) => {
    const gorev = await gorevOlustur(actor, await readJson(req));
    const row = await prisma.vehicleTask.findUniqueOrThrow({
      where: { id: gorev.id },
      include: { vehicle: { select: { id: true, plaka: true } } },
    });
    return created(serializeTask(row));
  });
}
