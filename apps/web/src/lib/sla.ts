import { prisma } from "@kars/db";
import type { AppSession } from "@/lib/authz";
import { departmentScope } from "@/lib/authz";

export type SlaSummary = {
  bucketLt24h: number;
  bucket1to3d: number;
  bucketGt3d: number;
  overdueUrgent: Array<{
    id: string;
    sikayetNo: string;
    arayanKisi: string;
    oncelik: string;
    kayitTarihi: Date;
    departmentName: string | null;
  }>;
  byDepartment: Array<{
    departmentId: string | null;
    departmentName: string;
    acik: number;
    kapatilan30g: number;
    ortKapanisGun: number | null;
  }>;
};

export async function computeSlaSummary(session: AppSession): Promise<SlaSummary> {
  const dept = departmentScope(session);
  const now = Date.now();
  const h24 = new Date(now - 24 * 60 * 60 * 1000);
  const d3 = new Date(now - 3 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const openWhere = {
    durum: { in: ["ACIK", "DEVAM_EDIYOR"] as ("ACIK" | "DEVAM_EDIYOR")[] },
    ...dept,
  };

  const [lt24, d1to3, gt3, overdueUrgent, openByDept, closed30] = await Promise.all([
    prisma.complaint.count({
      where: { ...openWhere, kayitTarihi: { gte: h24 } },
    }),
    prisma.complaint.count({
      where: { ...openWhere, kayitTarihi: { lt: h24, gte: d3 } },
    }),
    prisma.complaint.count({
      where: { ...openWhere, kayitTarihi: { lt: d3 } },
    }),
    prisma.complaint.findMany({
      where: {
        ...openWhere,
        oncelik: { in: ["ACIL", "COK_ACIL"] },
        kayitTarihi: { lt: h24 },
      },
      orderBy: { kayitTarihi: "asc" },
      take: 15,
      select: {
        id: true,
        sikayetNo: true,
        arayanKisi: true,
        oncelik: true,
        kayitTarihi: true,
        department: { select: { name: true } },
      },
    }),
    prisma.complaint.groupBy({
      by: ["departmentId"],
      where: openWhere,
      _count: { _all: true },
    }),
    prisma.complaint.findMany({
      where: {
        durum: "KAPATILDI",
        kapanisTarihi: { gte: d30 },
        ...dept,
      },
      select: {
        departmentId: true,
        kayitTarihi: true,
        kapanisTarihi: true,
      },
    }),
  ]);

  const deptIds = [
    ...new Set([
      ...openByDept.map((g) => g.departmentId),
      ...closed30.map((c) => c.departmentId),
    ]),
  ].filter(Boolean) as string[];

  const departments = deptIds.length
    ? await prisma.department.findMany({
        where: { id: { in: deptIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameById = new Map(departments.map((d) => [d.id, d.name]));

  const closedAgg = new Map<
    string | null,
    { count: number; totalDays: number }
  >();
  for (const c of closed30) {
    if (!c.kapanisTarihi) continue;
    const key = c.departmentId;
    const days =
      (c.kapanisTarihi.getTime() - c.kayitTarihi.getTime()) / (24 * 60 * 60 * 1000);
    const cur = closedAgg.get(key) ?? { count: 0, totalDays: 0 };
    cur.count += 1;
    cur.totalDays += days;
    closedAgg.set(key, cur);
  }

  const openMap = new Map(
    openByDept.map((g) => [g.departmentId, g._count._all]),
  );

  const allKeys = new Set<string | null>([
    ...openMap.keys(),
    ...closedAgg.keys(),
  ]);

  const byDepartment = [...allKeys].map((departmentId) => {
    const closed = closedAgg.get(departmentId);
    return {
      departmentId,
      departmentName: departmentId
        ? (nameById.get(departmentId) ?? "—")
        : "Atanmamış",
      acik: openMap.get(departmentId) ?? 0,
      kapatilan30g: closed?.count ?? 0,
      ortKapanisGun:
        closed && closed.count > 0
          ? Math.round((closed.totalDays / closed.count) * 10) / 10
          : null,
    };
  }).sort((a, b) => b.acik - a.acik || b.kapatilan30g - a.kapatilan30g);

  return {
    bucketLt24h: lt24,
    bucket1to3d: d1to3,
    bucketGt3d: gt3,
    overdueUrgent: overdueUrgent.map((s) => ({
      id: s.id,
      sikayetNo: s.sikayetNo,
      arayanKisi: s.arayanKisi,
      oncelik: s.oncelik,
      kayitTarihi: s.kayitTarihi,
      departmentName: s.department?.name ?? null,
    })),
    byDepartment,
  };
}
