import { test, expect } from "@playwright/test";
import { KULLANICILAR, OTURUM } from "./auth-states";

/**
 * Temel E2E duman testi.
 * Önkoşul: çalışan panel (`npm run dev` veya `npm start`) + seed verisi.
 */
test.describe("Kars Saha Operasyon — giriş akışı", () => {
  // Giriş formunun kendisi test edildiği için kayıtlı oturum kullanılmaz
  test.use({ storageState: { cookies: [], origins: [] } });

  test("giriş → dashboard → şikayet listesi", async ({ page }) => {
    await page.goto("/giris");
    await page.locator('input[name="phone"]').fill(KULLANICILAR.admin.phone);
    await page.locator('input[name="password"]').fill(KULLANICILAR.admin.password);
    await page.getByRole("button", { name: /giriş/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/giris"), { timeout: 15_000 });
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(/dashboard|özet|şikayet/i).first()).toBeVisible();

    await page.goto("/sikayetler");
    await expect(page.locator("h1")).toContainText(/Şikayet Kayıt/i);
  });
});

test.describe("Kars Saha Operasyon — paneller", () => {
  test.use({ storageState: OTURUM.admin });

  test("görevlendirme sayfası açılır", async ({ page }) => {
    await page.goto("/gorevler");
    await expect(page.locator("h1")).toContainText(/Görevlendirme/i);
    await expect(page.getByText(/Müdürlük Kullanım Özeti/i)).toBeVisible();
  });

  test("komuta ekranı ve işlerim portalı açılır", async ({ page }) => {
    await page.goto("/komuta");
    await expect(page.locator("h1")).toContainText(/Komuta/i);

    await page.goto("/islerim");
    await expect(page.locator("h1")).toContainText(/İşlerim/i);
  });

  test("yol temizliği rota sayfası açılır", async ({ page }) => {
    await page.goto("/temizlik");
    await expect(page.locator("h1")).toContainText(/Yol Temizliği/i);
  });
});

test.describe("Kars Saha Operasyon — üst navigasyon", () => {
  test.use({ storageState: OTURUM.admin });

  test("masaüstünde kategoriler ve tıklamalı mega menü çalışır", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "Ana navigasyon" });
    await expect(nav).toBeVisible();
    for (const category of [
      "Operasyon",
      "Vatandaş & Görev",
      "Saha & Harita",
      "Filo & Üretim",
      "Kurum Yönetimi",
    ]) {
      await expect(nav.getByRole("button", { name: category })).toBeVisible();
    }

    await nav.getByRole("button", { name: "Operasyon" }).click();
    const mega = page.locator("#desktop-mega-menu");
    await expect(mega).toBeVisible();
    await expect(mega.getByRole("link", { name: /Komuta Ekranı/ })).toBeVisible();

    await nav.getByRole("button", { name: "Saha & Harita" }).click();
    await expect(mega.getByRole("link", { name: /Yol Haritası/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(mega).toBeHidden();

    await nav.getByRole("button", { name: "Operasyon" }).click();
    await expect(mega).toBeVisible();
    await page.locator("main").click({ position: { x: 10, y: 10 } });
    await expect(mega).toBeHidden();
  });

  test("mobil modül paneli ve aktif alt menü çalışır", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/gorevler");

    await page.getByRole("button", { name: "Modüller menüsünü aç" }).click();
    const menu = page.getByTestId("mobile-module-menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("heading", { name: "Modüller" })).toBeVisible();
    await menu.getByRole("button", { name: "Saha & Harita" }).click();
    await expect(menu.getByRole("link", { name: /Yol Haritası/ })).toBeVisible();
    await menu.getByRole("button", { name: "Modüller menüsünü kapat" }).click();
    await expect(menu).toBeHidden();
    await expect(page.getByRole("link", { name: "Görev", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

test.describe("Kars Saha Operasyon — rol bazlı üst navigasyon", () => {
  test.use({ storageState: OTURUM.cagriMerkezi });

  test("çağrı merkezi yalnız yetkili kategorileri görür", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/sikayetler");

    const nav = page.getByRole("navigation", { name: "Ana navigasyon" });
    await expect(nav.getByRole("button", { name: "Operasyon" })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Vatandaş & Görev" })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Saha & Harita" })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Filo & Üretim" })).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Kurum Yönetimi" })).toHaveCount(0);
  });
});
