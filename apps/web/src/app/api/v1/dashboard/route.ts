import type { Prisma } from "@kars/db";
import { prisma } from "@kars/db";
import { withApiUser, json } from "@/lib/api-v1";
import { departmentWhere, toAccessUser, vehicleDepartmentWhere } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await withApiUser(req);
  if (auth instanceof Response) return auth;

  const user = toAccessUser(auth.user);
  const dept = departmentWhere(user);
  const vehicleDept = vehicleDepartmentWhere(user);

  const taskWhere: Prisma.VehicleTaskWhereInput =
    user.role === "DEPARTMENT_MANAGER" && user.departmentId
      ? {
          OR: [
            { talepEdenDepartmentId: user.departmentId },
            { vehicle: { departmentId: user.departmentId } },
          ],
        }
      : user.role === "DRIVER" || user.role === "FIELD_WORKER"
        ? { driverId: user.id }
        : {};

  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);

  const [
    acikSikayetler,
    devamEdenSikayetler,
    kapaliSikayetler,
    bekleyenWhatsApp,
    aktifGorevler,
    planlananGorevler,
    aktifAraclar,
    bakimGereken,
    materials,
    sonSikayetler,
    sonGorevler,
  ] = await Promise.all([
    prisma.complaint.count({ where: { durum: "ACIK", ...dept } }),
    prisma.complaint.count({ where: { durum: "DEVAM_EDIYOR", ...dept } }),
    prisma.complaint.count({ where: { durum: "KAPATILDI", ...dept } }),
    user.role === "ADMIN" || user.role === "CALL_CENTER"
      ? prisma.whatsAppMessage.count({ where: { onayDurumu: "ONAY_BEKLIYOR" } })
      : Promise.resolve(0),
    prisma.vehicleTask.count({ where: { durum: "DEVAM_EDIYOR", ...taskWhere } }),
    prisma.vehicleTask.count({ where: { durum: "PLANLANDI", ...taskWhere } }),
    prisma.vehicle.count({ where: { envanterDurumu: "AKTIF", ...vehicleDept } }),
    prisma.vehicle.count({
      where: {
        ...vehicleDept,
        OR: [
          { muayeneTarihi: { lte: in30 } },
          { sigortaBitis: { lte: in30 } },
          { sonrakiBakimTarihi: { lte: in30 } },
        ],
        envanterDurumu: { not: "HURDAYA_AYRILDI" },
      },
    }),
    prisma.material.findMany({
      where: { aktif: true, ...dept },
      include: { movements: { select: { tip: true, miktar: true } } },
    }),
    prisma.complaint.findMany({
      where: dept,
      take: 8,
      orderBy: { kayitTarihi: "desc" },
      select: { id: true, sikayetNo: true, arayanKisi: true, durum: true, oncelik: true },
    }),
    prisma.vehicleTask.findMany({
      where: taskWhere,
      take: 8,
      orderBy: { talepTarihi: "desc" },
      select: {
        id: true,
        gorevNo: true,
        durum: true,
        vehicle: { select: { plaka: true } },
      },
    }),
  ]);

  const dusukStokMalzeme = materials.filter((m) => {
    const stok = m.movements.reduce((s, mv) => {
      const qty = Number(mv.miktar);
      return mv.tip === "GIRIS" ? s + qty : s - qty;
    }, 0);
    return stok <= m.kritikStok;
  }).length;

  return json({
    acikSikayetler,
    devamEdenSikayetler,
    kapaliSikayetler,
    bekleyenWhatsApp,
    aktifGorevler,
    planlananGorevler,
    aktifAraclar,
    bakimGereken,
    dusukStokMalzeme,
    sonSikayetler,
    sonGorevler: sonGorevler.map((g) => ({
      id: g.id,
      gorevNo: g.gorevNo,
      durum: g.durum,
      plaka: g.vehicle.plaka,
    })),
  });
}
