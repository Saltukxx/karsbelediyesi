import type { Rol } from "@kars/shared";

export type NavGroupId =
  | "operasyon"
  | "vatandas"
  | "saha"
  | "filo_uretim"
  | "kurum";

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
  | "Radar"
  | "LandPlot"
  | "Snowflake"
  | "Trash2"
  | "Brush"
  | "ShieldCheck"
  | "Settings";

export interface NavGroup {
  id: NavGroupId;
  label: string;
}

export interface NavItem {
  href: string;
  label: string;
  description: string;
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
  { id: "operasyon", label: "Operasyon" },
  { id: "vatandas", label: "Vatandaş & Görev" },
  { id: "saha", label: "Saha & Harita" },
  { id: "filo_uretim", label: "Filo & Üretim" },
  { id: "kurum", label: "Kurum Yönetimi" },
];

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", description: "Kritik göstergeler ve günlük operasyon özeti", icon: "LayoutDashboard", group: "operasyon", roles: TUM_ROLLER },
  { href: "/komuta", label: "Komuta Ekranı", description: "Canlı saha durumu ve akıllı görevlendirme", icon: "Radar", group: "operasyon", roles: ["ADMIN", "DEPARTMENT_MANAGER"] },
  { href: "/raporlar", label: "Raporlar", description: "Performans, maliyet ve dönemsel analizler", icon: "BarChart3", group: "operasyon", roles: ["ADMIN", "DEPARTMENT_MANAGER", "APPROVER"] },
  { href: "/sikayetler", label: "Şikayet Kayıt & Takip", description: "Vatandaş başvuruları ve çözüm süreçleri", icon: "PhoneCall", group: "vatandas", roles: ["ADMIN", "CALL_CENTER", "DEPARTMENT_MANAGER", "APPROVER"] },
  { href: "/islerim", label: "İşlerim", description: "Size atanan açık ve devam eden işler", icon: "ClipboardList", group: "vatandas", roles: ["ADMIN", ...SAHA] },
  { href: "/whatsapp", label: "WhatsApp Kuyruğu", description: "Gelen mesajları inceleme ve yanıtlama", icon: "MessageCircle", group: "vatandas", roles: ["ADMIN", "CALL_CENTER"] },
  { href: "/gorevler", label: "Görevlendirme", description: "Araç, personel ve görev planlama", icon: "ClipboardList", group: "vatandas", roles: ["ADMIN", "DEPARTMENT_MANAGER", "APPROVER", ...SAHA] },
  { href: "/kontrol-listeleri", label: "Kontrol Listeleri", description: "Saha kontrolleri, onay ve takip", icon: "CheckSquare", group: "vatandas", roles: ["ADMIN", "DEPARTMENT_MANAGER", "APPROVER", ...SAHA] },
  { href: "/harita", label: "Yol Haritası", description: "Yollar, engeller ve şikayet katmanları", icon: "Map", group: "saha", roles: TUM_ROLLER },
  { href: "/parsel", label: "Parsel Sorgu", description: "Ada, parsel ve konum bilgisi sorgulama", icon: "LandPlot", group: "saha", roles: TUM_ROLLER },
  { href: "/kis", label: "Kış Operasyonu", description: "Kar küreme ve tuzlama rotaları", icon: "Snowflake", group: "saha", roles: TUM_ROLLER },
  { href: "/cop", label: "Çöp Toplama", description: "Toplama rotaları ve operasyon kayıtları", icon: "Trash2", group: "saha", roles: TUM_ROLLER },
  { href: "/temizlik", label: "Yol Temizliği", description: "Süpürme ve yıkama güzergahları", icon: "Brush", group: "saha", roles: TUM_ROLLER },
  { href: "/araclar", label: "Araç Envanteri", description: "Araçlar, zimmetler ve durum takibi", icon: "Truck", group: "filo_uretim", roles: ["ADMIN", "DEPARTMENT_MANAGER"] },
  { href: "/bakim", label: "Bakım Takip", description: "Bakım, muayene ve arıza kayıtları", icon: "Wrench", group: "filo_uretim", roles: ["ADMIN", "DEPARTMENT_MANAGER"] },
  { href: "/yakit", label: "Yakıt Takip", description: "Araç bazlı tüketim ve dolum kayıtları", icon: "Fuel", group: "filo_uretim", roles: ["ADMIN", "DEPARTMENT_MANAGER"] },
  { href: "/akaryakit", label: "Akaryakıt Analizi", description: "Tüketim eğilimleri ve maliyet analizi", icon: "LineChart", group: "filo_uretim", roles: ["ADMIN", "DEPARTMENT_MANAGER"] },
  { href: "/malzeme-depo", label: "Malzeme / Depo", description: "Stok, hareket ve kritik seviye takibi", icon: "Package", group: "filo_uretim", roles: ["ADMIN", "DEPARTMENT_MANAGER"] },
  { href: "/beton", label: "Beton Reçeteleri", description: "Reçete, üretim ve malzeme stokları", icon: "BrickWall", group: "filo_uretim", roles: ["ADMIN", "DEPARTMENT_MANAGER"] },
  { href: "/agrega", label: "Agrega Maliyet", description: "Üretim parametreleri ve maliyet hesabı", icon: "Mountain", group: "filo_uretim", roles: ["ADMIN", "DEPARTMENT_MANAGER"] },
  { href: "/bitum", label: "Bitüm Takip", description: "Depo, stok ve bitüm hareketleri", icon: "Droplets", group: "filo_uretim", roles: ["ADMIN", "DEPARTMENT_MANAGER"] },
  { href: "/personel", label: "Personel", description: "Personel kayıtları ve görev bilgileri", icon: "Users", group: "kurum", roles: ["ADMIN", "DEPARTMENT_MANAGER"] },
  { href: "/gunluk-calisma", label: "Günlük Çalışma", description: "Personel, araç ve mesai kayıtları", icon: "Clock3", group: "kurum", roles: ["ADMIN", "DEPARTMENT_MANAGER", ...SAHA] },
  { href: "/tanimlar", label: "Tanımlar & Yönetim", description: "Kullanıcılar ve kurumsal tanımlar", icon: "Settings", group: "kurum", roles: ["ADMIN"] },
  { href: "/denetim", label: "Denetim İzi", description: "Kullanıcı ve işlem geçmişi", icon: "ShieldCheck", group: "kurum", roles: ["ADMIN"] },
];

/** Rol bazlı hızlı erişim bağlantıları (mega menü, max 4) */
const FAVORITES: Record<Rol, string[]> = {
  ADMIN: ["/", "/sikayetler", "/gorevler", "/araclar"],
  CALL_CENTER: ["/sikayetler", "/sikayetler/yeni", "/whatsapp"],
  DEPARTMENT_MANAGER: ["/", "/sikayetler", "/gorevler", "/araclar"],
  APPROVER: ["/sikayetler", "/gorevler", "/raporlar"],
  DRIVER: ["/islerim", "/gorevler", "/gunluk-calisma"],
  FIELD_WORKER: ["/islerim", "/gorevler", "/kontrol-listeleri", "/gunluk-calisma"],
};

/** Varsayılan landing (layout redirect) */
export function landingPathForRole(role: Rol): string {
  switch (role) {
    case "CALL_CENTER":
      return "/sikayetler";
    case "FIELD_WORKER":
      return "/islerim";
    case "DRIVER":
      return "/";
    default:
      return "/";
  }
}

export function navForRole(role: Rol): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(role));
}

export function favoritesForRole(role: Rol): NavItem[] {
  const hrefs = FAVORITES[role] ?? [];
  const byHref = new Map(NAV_ITEMS.map((i) => [i.href, i]));
  // /sikayetler/yeni menüde yok — sentetik ekle
  const extras: Record<string, NavItem> = {
    "/sikayetler/yeni": {
      href: "/sikayetler/yeni",
      label: "Yeni Şikayet",
      description: "Yeni vatandaş başvurusu oluştur",
      icon: "PhoneCall",
      group: "vatandas",
      roles: ["ADMIN", "CALL_CENTER", "DEPARTMENT_MANAGER", "APPROVER"],
    },
  };
  return hrefs
    .map((h) => byHref.get(h) ?? extras[h])
    .filter((i): i is NavItem => Boolean(i) && i.roles.includes(role))
    .slice(0, 4);
}

export function groupedNav(items: NavItem[]): Array<{ group: NavGroup; items: NavItem[] }> {
  return NAV_GROUPS.map((group) => ({
    group,
    items: items.filter((i) => i.group === group.id),
  })).filter((g) => g.items.length > 0);
}

export function navGroupForPath(
  pathname: string,
  items: NavItem[] = NAV_ITEMS,
): NavGroupId | null {
  const match = items.find(
    (item) =>
      item.href === "/"
        ? pathname === "/"
        : pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.group ?? null;
}

export function pageTitleForPath(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  const match = NAV_ITEMS.find(
    (i) => i.href !== "/" && (pathname === i.href || pathname.startsWith(`${i.href}/`)),
  );
  return match?.label ?? "Saha Operasyon";
}
