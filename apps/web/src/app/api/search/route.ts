import { NextResponse } from "next/server";
import type { Prisma } from "@kars/db";
import { prisma } from "@kars/db";
import { auth } from "@/auth";
import { departmentWhere, vehicleDepartmentWhere } from "@/lib/access";
import type { SessionUser } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const dept = departmentWhere(user);
  const vehicleDept = vehicleDepartmentWhere(user);
  const canComplaints = ["ADMIN", "CALL_CENTER", "DEPARTMENT_MANAGER", "APPROVER"].includes(
    user.role,
  );
  const canVehicles = ["ADMIN", "DEPARTMENT_MANAGER"].includes(user.role);
  const canPersonnel = ["ADMIN", "DEPARTMENT_MANAGER"].includes(user.role);
  const canTasks = [
    "ADMIN",
    "DEPARTMENT_MANAGER",
    "APPROVER",
    "DRIVER",
    "FIELD_WORKER",
  ].includes(user.role);

  const complaintWhere: Prisma.ComplaintWhereInput = {
    ...dept,
    OR: [
      { sikayetNo: { contains: q, mode: "insensitive" } },
      { arayanKisi: { contains: q, mode: "insensitive" } },
      { telefon: { contains: q } },
    ],
  };

  const taskWhere: Prisma.VehicleTaskWhereInput = {
    OR: [
      { gorevNo: { contains: q, mode: "insensitive" } },
      { gorevYeri: { contains: q, mode: "insensitive" } },
      { gorevTanimi: { contains: q, mode: "insensitive" } },
    ],
  };
  if (user.role === "DEPARTMENT_MANAGER" && user.departmentId) {
    taskWhere.AND = [
      {
        OR: [
          { talepEdenDepartmentId: user.departmentId },
          { vehicle: { departmentId: user.departmentId } },
        ],
      },
    ];
  } else if (user.role === "DRIVER" || user.role === "FIELD_WORKER") {
    taskWhere.driverId = user.id;
  }

  const [sikayetler, araclar, personel, gorevler] = await Promise.all([
    canComplaints
      ? prisma.complaint.findMany({
          where: complaintWhere,
          take: 8,
          orderBy: { kayitTarihi: "desc" },
          select: { id: true, sikayetNo: true, arayanKisi: true, durum: true },
        })
      : Promise.resolve([]),
    canVehicles
      ? prisma.vehicle.findMany({
          where: {
            ...vehicleDept,
            OR: [
              { plaka: { contains: q, mode: "insensitive" } },
              { ad: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 8,
          orderBy: { plaka: "asc" },
          select: { id: true, plaka: true, ad: true },
        })
      : Promise.resolve([]),
    canPersonnel
      ? prisma.personnel.findMany({
          where: {
            ...dept,
            OR: [
              { adSoyad: { contains: q, mode: "insensitive" } },
              { telefon: { contains: q } },
            ],
          },
          take: 8,
          orderBy: { adSoyad: "asc" },
          select: { id: true, adSoyad: true, unvan: true },
        })
      : Promise.resolve([]),
    canTasks
      ? prisma.vehicleTask.findMany({
          where: taskWhere,
          take: 8,
          orderBy: { talepTarihi: "desc" },
          select: {
            id: true,
            gorevNo: true,
            gorevYeri: true,
            vehicle: { select: { plaka: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const results = [
    ...sikayetler.map((s) => ({
      type: "Şikayet",
      label: s.sikayetNo,
      sub: s.arayanKisi,
      href: `/sikayetler/${s.id}`,
    })),
    ...araclar.map((a) => ({
      type: "Araç",
      label: a.plaka,
      sub: a.ad ?? undefined,
      href: `/araclar/${a.id}`,
    })),
    ...personel.map((p) => ({
      type: "Personel",
      label: p.adSoyad,
      sub: p.unvan ?? undefined,
      href: `/personel`,
    })),
    ...gorevler.map((g) => ({
      type: "Görev",
      label: g.gorevNo,
      sub: g.vehicle.plaka + (g.gorevYeri ? ` · ${g.gorevYeri}` : ""),
      href: `/gorevler`,
    })),
  ];

  return NextResponse.json({ results });
}
