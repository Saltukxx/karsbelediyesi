import type { Rol } from "@kars/shared";

export type NavGroupId =
  | "genel"
  | "cagri"
  | "filo"
  | "uretim"
  | "insan"
  | "yonetim";

export type NavIconName =
  | "LayoutDashboard"
  | "PhoneCall"
  | "MessageCircle"
  | "Truck"
  | "Wrench"
  | "Fuel"
  | "LineChart"
  | "Package"
  | "BrickWall"
  | "Mountain"
  | "Droplets"
  | "ClipboardList"
  | "CheckSquare"
  | "Users"
  | "Clock3"
  | "BarChart3"
  | "Map"
  | "LandPlot"
  | "Snowflake"
  | "Trash2"
  | "ShieldCheck"
  | "Settings";

export interface NavGroup {
  id: NavGroupId;
  label: string;
}

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
  group: NavGroupId;
  roles: Rol[];
}

const TUM_ROLLER: Rol[] = [
  "ADMIN",
  "CALL_CENTER",
  "DEPARTMENT_MANAGER",
  "FIELD_WORKER",
  "DRIVER",
  "APPROVER",
];

const SAHA: Rol[] = ["DRIVER", "FIELD_WORKER"];

export const NAV_GROUPS: NavGroup[] = [
  { id: "genel", label: "Genel" },
  { id: "cagri", label: "Çağrı / İş" },
  { id: "filo", label: "Filo" },
  { id: "uretim", label: "Üretim / Depo" },
  { id: "insan", label: "İnsan / Mesai" },
  { id: "yonetim", label: "Yönetim" },
];

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "LayoutDashboard", group: "genel", roles: TUM_ROLLER },
  { href: "/raporlar", label: "Raporlar", icon: "BarChart3", group: "genel", roles: ["ADMIN", "DEPARTMENT_MANAGER", "APPROVER"] },
  { href: "/harita", label: "Yol Haritası", icon: "Map", group: "genel", roles: TUM_ROLLER },
  { href: "/parsel", label: "Parsel Sorgu", icon: "LandPlot", group: "genel", roles: TUM_ROLLER },
  { href: "/kis", label: "Kış Operasyonu", icon: "Snowflake", group: "genel", roles: TUM_ROLLER },
  { href: "/cop", label: "Çöp Toplama", icon: "Trash2", group: "genel", roles: TUM_ROLLER },
  { href: "/sikayetler", label: "Şikayet Kayıt & Takip", icon: "PhoneCall", group: "cagri", roles: ["ADMIN", "CALL_CENTER", "DEPARTMENT_MANAGER", "APPROVER"] },
  { href: "/whatsapp", label: "WhatsApp Kuyruğu", icon: "MessageCircle", group: "cagri", roles: ["ADMIN", "CALL_CENTER"] },
  { href: "/gorevler", label: "Görevlendirme", icon: "ClipboardList", group: "cagri", roles: ["ADMIN", "DEPARTMENT_MANAGER", "APPROVER", ...SAHA] },
  { href: "/kontrol-listeleri", label: "Kontrol Listeleri", icon: "CheckSquare", group: "cagri", roles: ["ADMIN", "DEPARTMENT_MANAGER", "APPROVER", ...SAHA] },
  { href: "/araclar", label: "Araç Envanteri", icon: "Truck", group: "filo", roles: ["ADMIN", "DEPARTMENT_MANAGER"] },
  { href: "/bakim", label: "Bakım Takip", icon: "Wrench", group: "filo", roles: ["ADMIN", "DEPARTMENT_MANAGER"] },
  { href: "/yakit", label: "Yakıt Takip", icon: "Fuel", group: "filo", roles: ["ADMIN", "DEPARTMENT_MANAGER"] },
  { href: "/akaryakit", label: "Akaryakıt Analizi", icon: "LineChart", group: "filo", roles: ["ADMIN", "DEPARTMENT_MANAGER"] },
  { href: "/malzeme-depo", label: "Malzeme / Depo", icon: "Package", group: "uretim", roles: ["ADMIN", "DEPARTMENT_MANAGER"] },
  { href: "/beton", label: "Beton Reçeteleri", icon: "BrickWall", group: "uretim", roles: ["ADMIN", "DEPARTMENT_MANAGER"] },
  { href: "/agrega", label: "Agrega Maliyet", icon: "Mountain", group: "uretim", roles: ["ADMIN", "DEPARTMENT_MANAGER"] },
  { href: "/bitum", label: "Bitüm Takip", icon: "Droplets", group: "uretim", roles: ["ADMIN", "DEPARTMENT_MANAGER"] },
  { href: "/personel", label: "Personel", icon: "Users", group: "insan", roles: ["ADMIN", "DEPARTMENT_MANAGER"] },
  { href: "/gunluk-calisma", label: "Günlük Çalışma", icon: "Clock3", group: "insan", roles: ["ADMIN", "DEPARTMENT_MANAGER", ...SAHA] },
  { href: "/tanimlar", label: "Tanımlar & Yönetim", icon: "Settings", group: "yonetim", roles: ["ADMIN"] },
  { href: "/denetim", label: "Denetim İzi", icon: "ShieldCheck", group: "yonetim", roles: ["ADMIN"] },
];

/** Rol bazlı sık kullanılanlar (sidebar, max 4) */
const FAVORITES: Record<Rol, string[]> = {
  ADMIN: ["/", "/sikayetler", "/gorevler", "/araclar"],
  CALL_CENTER: ["/sikayetler", "/sikayetler/yeni", "/whatsapp"],
  DEPARTMENT_MANAGER: ["/", "/sikayetler", "/gorevler", "/araclar"],
  APPROVER: ["/sikayetler", "/gorevler", "/raporlar"],
  DRIVER: ["/", "/gorevler", "/gunluk-calisma"],
  FIELD_WORKER: ["/", "/gorevler", "/kontrol-listeleri", "/gunluk-calisma"],
};

/** Varsayılan landing (layout redirect) */
export function landingPathForRole(role: Rol): string {
  switch (role) {
    case "CALL_CENTER":
      return "/sikayetler";
    case "DRIVER":
    case "FIELD_WORKER":
      return "/";
    default:
      return "/";
  }
}

export function navForRole(role: Rol): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(role)).map((i) => {
    if (i.href === "/" && (role === "DRIVER" || role === "FIELD_WORKER")) {
      return { ...i, label: "İşlerim" };
    }
    return i;
  });
}

export function favoritesForRole(role: Rol): NavItem[] {
  const hrefs = FAVORITES[role] ?? [];
  const byHref = new Map(NAV_ITEMS.map((i) => [i.href, i]));
  // /sikayetler/yeni menüde yok — sentetik ekle
  const extras: Record<string, NavItem> = {
    "/sikayetler/yeni": {
      href: "/sikayetler/yeni",
      label: "Yeni Şikayet",
      icon: "PhoneCall",
      group: "cagri",
      roles: ["ADMIN", "CALL_CENTER", "DEPARTMENT_MANAGER", "APPROVER"],
    },
  };
  return hrefs
    .map((h) => byHref.get(h) ?? extras[h])
    .filter((i): i is NavItem => Boolean(i) && i.roles.includes(role))
    .slice(0, 4)
    .map((i) => {
      if (i.href === "/" && (role === "DRIVER" || role === "FIELD_WORKER")) {
        return { ...i, label: "İşlerim" };
      }
      return i;
    });
}

export function groupedNav(items: NavItem[]): Array<{ group: NavGroup; items: NavItem[] }> {
  return NAV_GROUPS.map((group) => ({
    group,
    items: items.filter((i) => i.group === group.id),
  })).filter((g) => g.items.length > 0);
}

export function pageTitleForPath(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  const match = NAV_ITEMS.find(
    (i) => i.href !== "/" && (pathname === i.href || pathname.startsWith(`${i.href}/`)),
  );
  return match?.label ?? "Saha Operasyon";
}
