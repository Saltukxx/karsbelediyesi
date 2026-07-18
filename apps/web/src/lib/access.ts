import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import type { Rol } from "@kars/shared";
import { prisma } from "@kars/db";
import type { AppSession } from "@/lib/authz";

export type AccessUser = {
  id: string;
  role: Rol;
  departmentId: string | null;
};

/** Manager without department sees nothing (never org-wide). */
export function departmentWhere(
  user: AccessUser | AppSession["user"],
): { departmentId: string } | { departmentId: { in: string[] } } | Record<string, never> {
  if (user.role !== "DEPARTMENT_MANAGER") return {};
  if (!user.departmentId) return { departmentId: { in: [] } };
  return { departmentId: user.departmentId };
}

export function vehicleDepartmentWhere(
  user: AccessUser | AppSession["user"],
): { departmentId: string } | { departmentId: { in: string[] } } | Record<string, never> {
  return departmentWhere(user);
}

type ComplaintAccessRow = {
  id: string;
  departmentId: string | null;
  vehicle?: { atananSoforId: string | null } | null;
  personel?: { personnelId: string; personnel?: { userId: string | null } | null }[];
};

export function canAccessComplaint(user: AccessUser, complaint: ComplaintAccessRow): boolean {
  if (user.role === "ADMIN" || user.role === "CALL_CENTER" || user.role === "APPROVER") {
    return true;
  }
  if (user.role === "DEPARTMENT_MANAGER") {
    return !!user.departmentId && complaint.departmentId === user.departmentId;
  }
  if (user.role === "DRIVER" || user.role === "FIELD_WORKER") {
    if (complaint.vehicle?.atananSoforId === user.id) return true;
    return (complaint.personel ?? []).some((p) => p.personnel?.userId === user.id);
  }
  return false;
}

type TaskAccessRow = {
  id: string;
  driverId: string | null;
  talepEdenDepartmentId: string | null;
  vehicle?: { departmentId: string | null; atananSoforId: string | null } | null;
};

export function canAccessTask(user: AccessUser, task: TaskAccessRow): boolean {
  if (user.role === "ADMIN" || user.role === "APPROVER") return true;
  if (user.role === "DEPARTMENT_MANAGER") {
    if (!user.departmentId) return false;
    return (
      task.talepEdenDepartmentId === user.departmentId ||
      task.vehicle?.departmentId === user.departmentId
    );
  }
  if (user.role === "DRIVER" || user.role === "FIELD_WORKER") {
    return task.driverId === user.id || task.vehicle?.atananSoforId === user.id;
  }
  return false;
}

type VehicleAccessRow = {
  id: string;
  departmentId: string | null;
  atananSoforId: string | null;
};

export function canAccessVehicle(user: AccessUser, vehicle: VehicleAccessRow): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "DEPARTMENT_MANAGER") {
    return !!user.departmentId && vehicle.departmentId === user.departmentId;
  }
  if (user.role === "DRIVER" || user.role === "FIELD_WORKER") {
    return vehicle.atananSoforId === user.id;
  }
  return false;
}

export async function loadComplaintForAccess(id: string) {
  return prisma.complaint.findUnique({
    where: { id },
    include: {
      vehicle: { select: { atananSoforId: true } },
      personel: { include: { personnel: { select: { userId: true } } } },
    },
  });
}

export async function loadTaskForAccess(id: string) {
  return prisma.vehicleTask.findUnique({
    where: { id },
    include: {
      vehicle: { select: { departmentId: true, atananSoforId: true } },
    },
  });
}

export async function loadVehicleForAccess(id: string) {
  return prisma.vehicle.findUnique({
    where: { id },
    select: { id: true, departmentId: true, atananSoforId: true },
  });
}

/** Panel: missing/forbidden → notFound */
export async function assertComplaintPageAccess(session: AppSession, id: string) {
  const row = await loadComplaintForAccess(id);
  if (!row || !canAccessComplaint(session.user, row)) notFound();
  return row;
}

export async function assertTaskPageAccess(session: AppSession, id: string) {
  const row = await loadTaskForAccess(id);
  if (!row || !canAccessTask(session.user, row)) notFound();
  return row;
}

/** API: 404 if missing, 403 if forbidden */
export function apiDeny(): NextResponse {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function apiNotFound(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function assertComplaintApiAccess(
  user: AccessUser,
  id: string,
): Promise<{ ok: true; row: NonNullable<Awaited<ReturnType<typeof loadComplaintForAccess>>> } | NextResponse> {
  const row = await loadComplaintForAccess(id);
  if (!row) return apiNotFound();
  if (!canAccessComplaint(user, row)) return apiDeny();
  return { ok: true, row };
}

export async function assertTaskApiAccess(
  user: AccessUser,
  id: string,
): Promise<{ ok: true; row: NonNullable<Awaited<ReturnType<typeof loadTaskForAccess>>> } | NextResponse> {
  const row = await loadTaskForAccess(id);
  if (!row) return apiNotFound();
  if (!canAccessTask(user, row)) return apiDeny();
  return { ok: true, row };
}

export async function assertVehicleApiAccess(
  user: AccessUser,
  id: string,
): Promise<{ ok: true; row: NonNullable<Awaited<ReturnType<typeof loadVehicleForAccess>>> } | NextResponse> {
  const row = await loadVehicleForAccess(id);
  if (!row) return apiNotFound();
  if (!canAccessVehicle(user, row)) return apiDeny();
  return { ok: true, row };
}

/** Resolve personnel.userId for field assignment checks */
export async function userPersonnelId(userId: string): Promise<string | null> {
  const p = await prisma.personnel.findFirst({
    where: { userId },
    select: { id: true },
  });
  return p?.id ?? null;
}

export function toAccessUser(user: {
  id: string;
  role: Rol | string;
  departmentId: string | null;
}): AccessUser {
  return {
    id: user.id,
    role: user.role as Rol,
    departmentId: user.departmentId,
  };
}
