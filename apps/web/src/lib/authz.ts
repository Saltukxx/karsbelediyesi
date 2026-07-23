import { redirect } from "next/navigation";
import type { Rol } from "@kars/shared";
import { auth } from "@/auth";
import { landingPathForRole, NAV_ITEMS } from "@/lib/nav";

export type SessionUser = {
  id: string;
  name: string;
  phone: string;
  role: Rol;
  departmentId: string | null;
};

export type AppSession = {
  user: SessionUser;
};

/** Şikayet oluşturma vb. menü dışı yollar */
const EXTRA_PATH_ROLES: Array<{ prefix: string; roles: Rol[] }> = [
  {
    prefix: "/sikayetler",
    roles: ["ADMIN", "CALL_CENTER", "DEPARTMENT_MANAGER", "APPROVER"],
  },
  {
    prefix: "/kontrol-listeleri",
    roles: ["ADMIN", "DEPARTMENT_MANAGER", "APPROVER", "DRIVER", "FIELD_WORKER"],
  },
  {
    prefix: "/araclar",
    roles: ["ADMIN", "DEPARTMENT_MANAGER"],
  },
  {
    prefix: "/gorevler",
    roles: ["ADMIN", "DEPARTMENT_MANAGER", "APPROVER", "DRIVER", "FIELD_WORKER"],
  },
];

export const ACTION_ROLES = {
  definitions: ["ADMIN"] as Rol[],
  whatsapp: ["ADMIN", "CALL_CENTER"] as Rol[],
  complaints: ["ADMIN", "CALL_CENTER", "DEPARTMENT_MANAGER", "APPROVER"] as Rol[],
  tasks: ["ADMIN", "DEPARTMENT_MANAGER", "APPROVER", "DRIVER", "FIELD_WORKER"] as Rol[],
  checklists: ["ADMIN", "DEPARTMENT_MANAGER", "APPROVER", "DRIVER", "FIELD_WORKER"] as Rol[],
  vehicles: ["ADMIN", "DEPARTMENT_MANAGER"] as Rol[],
  fuel: ["ADMIN", "DEPARTMENT_MANAGER"] as Rol[],
  materials: ["ADMIN", "DEPARTMENT_MANAGER"] as Rol[],
  concrete: ["ADMIN", "DEPARTMENT_MANAGER"] as Rol[],
  agrega: ["ADMIN", "DEPARTMENT_MANAGER"] as Rol[],
  bitum: ["ADMIN", "DEPARTMENT_MANAGER"] as Rol[],
  personnel: ["ADMIN", "DEPARTMENT_MANAGER"] as Rol[],
  worklogs: ["ADMIN", "DEPARTMENT_MANAGER", "DRIVER", "FIELD_WORKER"] as Rol[],
  reports: ["ADMIN", "DEPARTMENT_MANAGER", "APPROVER"] as Rol[],
  harita: ["ADMIN", "DEPARTMENT_MANAGER"] as Rol[],
  kis: ["ADMIN", "DEPARTMENT_MANAGER"] as Rol[],
  cop: ["ADMIN", "DEPARTMENT_MANAGER"] as Rol[],
  dispatch: ["ADMIN", "DEPARTMENT_MANAGER"] as Rol[],
} as const;

export const EXPORT_ENTITY_ROLES: Record<string, Rol[]> = {
  sikayetler: ACTION_ROLES.complaints,
  araclar: ACTION_ROLES.vehicles,
  gorevler: ACTION_ROLES.tasks,
  yakit: ACTION_ROLES.fuel,
  bakim: ACTION_ROLES.vehicles,
  akaryakit: ACTION_ROLES.fuel,
  personel: ACTION_ROLES.personnel,
  malzeme: ACTION_ROLES.materials,
  beton: ACTION_ROLES.concrete,
  bitum: ACTION_ROLES.bitum,
};

export async function requireSession(): Promise<AppSession> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Oturum gerekli");
  }
  return session as AppSession;
}

export async function requireRoles(roles: Rol[]): Promise<AppSession> {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) {
    throw new Error("Yetkisiz");
  }
  return session;
}

export function rolesForPath(pathname: string): Rol[] | null {
  if (pathname === "/") {
    return NAV_ITEMS.find((i) => i.href === "/")?.roles ?? null;
  }

  const navMatch = NAV_ITEMS.filter((i) => i.href !== "/").find(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
  );
  if (navMatch) return navMatch.roles;

  const extra = EXTRA_PATH_ROLES.find(
    (e) => pathname === e.prefix || pathname.startsWith(`${e.prefix}/`),
  );
  return extra?.roles ?? null;
}

/** Sayfa erişimi — yetkisizse rol landing'ine yönlendir */
export async function requirePageAccess(pathname: string): Promise<AppSession> {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris");

  const allowed = rolesForPath(pathname);
  if (allowed && !allowed.includes(session.user.role as Rol)) {
    redirect(landingPathForRole(session.user.role as Rol));
  }
  return session as AppSession;
}

/**
 * DEPARTMENT_MANAGER için departmentId filtresi.
 * Müdürlük atanmamış manager → boş küme (org-wide sızıntı yok).
 */
export function departmentScope(
  session: AppSession,
): { departmentId: string } | { departmentId: { in: string[] } } | Record<string, never> {
  if (session.user.role !== "DEPARTMENT_MANAGER") return {};
  if (!session.user.departmentId) return { departmentId: { in: [] } };
  return { departmentId: session.user.departmentId };
}

export function isDepartmentManager(session: AppSession): boolean {
  return session.user.role === "DEPARTMENT_MANAGER" && !!session.user.departmentId;
}
