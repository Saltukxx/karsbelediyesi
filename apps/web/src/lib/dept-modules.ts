import { prisma } from "@kars/db";
import type { Rol } from "@kars/shared";
import {
  NAV_GROUPS,
  NAV_ITEMS,
  type NavGroupId,
  type NavItem,
} from "@/lib/nav";

const SETTING_PREFIX = "dept.modules.";

/** Çağrı merkezi için sabit, vatandaş odaklı modül seti */
export const CALL_CENTER_MODULES = new Set([
  "/",
  "/sikayetler",
  "/sikayetler/yeni",
  "/whatsapp",
  "/harita",
  "/parsel",
]);

/** Allowlist boş/tanımsızken tüm gruplar açık (geriye dönük uyumluluk) */
export const ALL_MODULE_GROUPS: NavGroupId[] = NAV_GROUPS.map((g) => g.id);

export function deptModulesSettingKey(departmentId: string): string {
  return `${SETTING_PREFIX}${departmentId}`;
}

export function parseModuleGroups(raw: string | null | undefined): NavGroupId[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const valid = new Set(ALL_MODULE_GROUPS);
    const groups = parsed.filter((g): g is NavGroupId => valid.has(g as NavGroupId));
    return groups.length > 0 ? groups : null;
  } catch {
    return null;
  }
}

export async function loadDepartmentModuleGroups(
  departmentId: string | null | undefined,
): Promise<NavGroupId[] | null> {
  if (!departmentId) return null;
  const row = await prisma.appSetting.findUnique({
    where: { key: deptModulesSettingKey(departmentId) },
    select: { value: true },
  });
  return parseModuleGroups(row?.value);
}

export async function loadAllDepartmentModuleMaps(): Promise<
  Record<string, NavGroupId[]>
> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { startsWith: SETTING_PREFIX } },
    select: { key: true, value: true },
  });
  const out: Record<string, NavGroupId[]> = {};
  for (const row of rows) {
    const deptId = row.key.slice(SETTING_PREFIX.length);
    const groups = parseModuleGroups(row.value);
    if (deptId && groups) out[deptId] = groups;
  }
  return out;
}

/**
 * Rol menüsünü müdürlük modül allowlist'ine göre daraltır.
 * ADMIN → filtre yok. CALL_CENTER → sabit set.
 * DEPARTMENT_MANAGER → grup allowlist (yoksa tüm rol menüsü).
 * Saha rolleri (DRIVER/FIELD_WORKER) → etkilenmez.
 */
export function filterNavByDepartmentModules(
  items: NavItem[],
  opts: {
    role: Rol;
    moduleGroups: NavGroupId[] | null;
  },
): NavItem[] {
  if (opts.role === "ADMIN") return items;

  if (opts.role === "CALL_CENTER") {
    return items.filter((i) => CALL_CENTER_MODULES.has(i.href));
  }

  if (opts.role !== "DEPARTMENT_MANAGER") return items;

  if (!opts.moduleGroups || opts.moduleGroups.length === 0) return items;

  const allowed = new Set(opts.moduleGroups);
  // Dashboard her zaman görünür (operasyon grubu kapalı olsa bile)
  return items.filter((i) => i.href === "/" || allowed.has(i.group));
}

/** Pathname'in allowlist'te olup olmadığını kontrol eder */
export function pathAllowedByModules(
  pathname: string,
  opts: {
    role: Rol;
    moduleGroups: NavGroupId[] | null;
  },
): boolean {
  if (opts.role === "ADMIN") return true;

  if (opts.role === "CALL_CENTER") {
    if (pathname === "/" || pathname.startsWith("/sikayetler")) return true;
    return [...CALL_CENTER_MODULES].some(
      (h) => h !== "/" && (pathname === h || pathname.startsWith(`${h}/`)),
    );
  }

  if (opts.role !== "DEPARTMENT_MANAGER") return true;

  if (!opts.moduleGroups || opts.moduleGroups.length === 0) return true;

  if (pathname === "/") return true;

  const allowed = new Set(opts.moduleGroups);
  const match = NAV_ITEMS.filter((i) => i.href !== "/").find(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
  );
  if (!match) return true; // menü dışı yollar rol kontrolüne bırakılır
  return allowed.has(match.group);
}

export const MODULE_GROUP_OPTIONS = NAV_GROUPS.map((g) => ({
  id: g.id,
  label: g.label,
}));
