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
