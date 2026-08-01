import { describe, expect, it } from "vitest";
import type { Rol } from "@kars/shared";
import {
  NAV_GROUPS,
  NAV_ITEMS,
  favoritesForRole,
  groupedNav,
  navForRole,
  navGroupForPath,
} from "./nav";

const ROLLER: Rol[] = [
  "ADMIN",
  "CALL_CENTER",
  "DEPARTMENT_MANAGER",
  "FIELD_WORKER",
  "DRIVER",
  "APPROVER",
];

describe("üst navigasyon bilgi mimarisi", () => {
  it("admin için beş kategoriyi sırasıyla gösterir", () => {
    const groups = groupedNav(navForRole("ADMIN"));
    expect(groups.map(({ group }) => group.id)).toEqual([
      "operasyon",
      "vatandas",
      "saha",
      "filo_uretim",
      "kurum",
    ]);
    expect(groups.map(({ group }) => group.label)).toEqual(
      NAV_GROUPS.map((group) => group.label),
    );
  });

  it("her rolde yalnız izin verilen öğeleri ve dolu kategorileri döndürür", () => {
    for (const role of ROLLER) {
      const items = navForRole(role);
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((item) => item.roles.includes(role))).toBe(true);
      expect(groupedNav(items).every(({ items: groupItems }) => groupItems.length > 0)).toBe(
        true,
      );
    }

    const callCenterHrefs = navForRole("CALL_CENTER").map((item) => item.href);
    expect(callCenterHrefs).not.toContain("/araclar");
    expect(callCenterHrefs).not.toContain("/tanimlar");
    expect(callCenterHrefs).toContain("/whatsapp");
  });

  it("detay rotalarını doğru kategoriyle eşleştirir", () => {
    const cases = [
      ["/", "operasyon"],
      ["/komuta", "operasyon"],
      ["/sikayetler/abc", "vatandas"],
      ["/gorevler/abc/takip", "vatandas"],
      ["/harita", "saha"],
      ["/araclar/abc", "filo_uretim"],
      ["/denetim", "kurum"],
    ] as const;

    for (const [pathname, expected] of cases) {
      expect(navGroupForPath(pathname)).toBe(expected);
    }
    expect(navGroupForPath("/bilinmeyen")).toBeNull();
  });

  it("hızlı erişimi role göre sınırlar ve en fazla dört öğe döndürür", () => {
    for (const role of ROLLER) {
      const favorites = favoritesForRole(role);
      expect(favorites.length).toBeLessThanOrEqual(4);
      expect(favorites.every((item) => item.roles.includes(role))).toBe(true);
      expect(new Set(favorites.map((item) => item.href)).size).toBe(favorites.length);
    }
    expect(favoritesForRole("CALL_CENTER").map((item) => item.href)).toContain(
      "/sikayetler/yeni",
    );
  });

  it("her navigasyon öğesinde mega menü açıklaması bulunur", () => {
    expect(NAV_ITEMS.every((item) => item.description.trim().length > 0)).toBe(true);
  });
});
