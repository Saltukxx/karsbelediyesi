import type { Rol, User } from "@kars/db";
import { requireApiUser } from "@/lib/mobile-auth";
import {
  requireSession,
  type AppSession,
  type SessionUser,
} from "@/lib/authz";
import { loadDepartmentModuleHrefs } from "@/lib/dept-modules";

export function apiUserToSession(user: User): AppSession {
  return {
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role as Rol,
      departmentId: user.departmentId,
    },
  };
}

/** Cookie oturumu veya Bearer JWT — ops / search / export için. */
export async function requireSessionOrApiUser(
  req: Request,
): Promise<AppSession> {
  const apiUser = await requireApiUser(req);
  if (apiUser) return apiUserToSession(apiUser);
  return requireSession();
}

export async function trySessionOrApiUser(
  req: Request,
): Promise<AppSession | null> {
  const apiUser = await requireApiUser(req);
  if (apiUser) return apiUserToSession(apiUser);
  try {
    return await requireSession();
  } catch {
    return null;
  }
}

export async function moduleHrefsForUser(
  user: SessionUser,
): Promise<string[] | null> {
  return loadDepartmentModuleHrefs(user.departmentId);
}

export async function requireRolesOrApi(
  req: Request,
  roles: readonly Rol[],
): Promise<AppSession> {
  const session = await requireSessionOrApiUser(req);
  if (!roles.includes(session.user.role)) {
    throw new Error("Yetkisiz");
  }
  return session;
}
