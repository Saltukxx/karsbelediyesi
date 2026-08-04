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

/** Allowlist boş/tanımsızken tüm menü href'leri açık */
export const ALL_MODULE_HREFS: string[] = NAV_ITEMS.map((i) => i.href);

const GROUP_IDS = new Set<string>(NAV_GROUPS.map((g) => g.id));
const HREF_SET = new Set(ALL_MODULE_HREFS);

export function deptModulesSettingKey(departmentId: string): string {
  return `${SETTING_PREFIX}${departmentId}`;
}

/** Eski NavGroupId listesini o grubun tüm href'lerine genişletir */
function expandGroupsToHrefs(groups: NavGroupId[]): string[] {
  const hrefs = NAV_ITEMS.filter((i) => groups.includes(i.group)).map((i) => i.href);
  if (!hrefs.includes("/")) hrefs.unshift("/");
  return [...new Set(hrefs)];
}

/**
 * AppSetting JSON'unu href listesine çevirir.
 * Eski format (grup id'leri) otomatik expand edilir.
 */
export function parseModuleHrefs(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    const asStrings = parsed.filter((x): x is string => typeof x === "string");
    if (asStrings.length === 0) return null;

    // Hepsi geçerli href ise yeni format
    if (asStrings.every((h) => HREF_SET.has(h) || h === "/sikayetler/yeni")) {
      return asStrings.includes("/") ? asStrings : ["/", ...asStrings];
    }

    // Hepsi grup id ise eski format
    if (asStrings.every((g) => GROUP_IDS.has(g))) {
      return expandGroupsToHrefs(asStrings as NavGroupId[]);
    }

    // Karışık: href olanları al, grup olanları expand et
    const hrefs = new Set<string>(["/"]);
    for (const item of asStrings) {
      if (HREF_SET.has(item) || item === "/sikayetler/yeni") hrefs.add(item);
      else if (GROUP_IDS.has(item)) {
        for (const h of expandGroupsToHrefs([item as NavGroupId])) hrefs.add(h);
      }
    }
    return hrefs.size > 1 ? [...hrefs] : null;
  } catch {
    return null;
  }
}

/** @deprecated Grup API — geriye dönük; parseModuleHrefs kullanın */
export function parseModuleGroups(raw: string | null | undefined): NavGroupId[] | null {
  const hrefs = parseModuleHrefs(raw);
  if (!hrefs) return null;
  const groups = new Set(
    NAV_ITEMS.filter((i) => hrefs.includes(i.href)).map((i) => i.group),
  );
  return groups.size > 0 ? [...groups] : null;
}

export async function loadDepartmentModuleHrefs(
  departmentId: string | null | undefined,
): Promise<string[] | null> {
  if (!departmentId) return null;
  const row = await prisma.appSetting.findUnique({
    where: { key: deptModulesSettingKey(departmentId) },
    select: { value: true },
  });
  return parseModuleHrefs(row?.value);
}

/** @deprecated */
export async function loadDepartmentModuleGroups(
  departmentId: string | null | undefined,
): Promise<NavGroupId[] | null> {
  const hrefs = await loadDepartmentModuleHrefs(departmentId);
  if (!hrefs) return null;
  return parseModuleGroups(JSON.stringify(hrefs));
}

export async function loadAllDepartmentModuleMaps(): Promise<
  Record<string, string[]>
> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { startsWith: SETTING_PREFIX } },
    select: { key: true, value: true },
  });
  const out: Record<string, string[]> = {};
  for (const row of rows) {
    const deptId = row.key.slice(SETTING_PREFIX.length);
    const hrefs = parseModuleHrefs(row.value);
    if (deptId && hrefs) out[deptId] = hrefs;
  }
  return out;
}

export function filterNavByDepartmentModules(
  items: NavItem[],
  opts: {
    role: Rol;
    moduleHrefs: string[] | null;
  },
): NavItem[] {
  if (opts.role === "ADMIN") return items;

  if (opts.role === "CALL_CENTER") {
    return items.filter((i) => CALL_CENTER_MODULES.has(i.href));
  }

  if (opts.role !== "DEPARTMENT_MANAGER") return items;

  if (!opts.moduleHrefs || opts.moduleHrefs.length === 0) return items;

  const allowed = new Set(opts.moduleHrefs);
  return items.filter((i) => i.href === "/" || allowed.has(i.href));
}

export function pathAllowedByModules(
  pathname: string,
  opts: {
    role: Rol;
    moduleHrefs: string[] | null;
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

  if (!opts.moduleHrefs || opts.moduleHrefs.length === 0) return true;

  if (pathname === "/") return true;

  const allowed = new Set(opts.moduleHrefs);
  const match = NAV_ITEMS.filter((i) => i.href !== "/").find(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
  );
  if (!match) return true;
  return allowed.has(match.href);
}

/** Tanımlar UI: grup başlığı altında href checkbox'ları */
export const MODULE_HREF_OPTIONS = NAV_GROUPS.map((g) => ({
  id: g.id,
  label: g.label,
  items: NAV_ITEMS.filter((i) => i.group === g.id).map((i) => ({
    href: i.href,
    label: i.label,
  })),
}));

/** @deprecated */
export const ALL_MODULE_GROUPS: NavGroupId[] = NAV_GROUPS.map((g) => g.id);
export const MODULE_GROUP_OPTIONS = NAV_GROUPS.map((g) => ({
  id: g.id,
  label: g.label,
}));
