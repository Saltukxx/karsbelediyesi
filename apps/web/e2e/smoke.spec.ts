import { test, expect } from "@playwright/test";

/**
 * Temel E2E duman testi.
 * Önkoşul: `npm run dev` + seed (admin / admin123)
 */
test.describe("Kars Saha Operasyon", () => {
  test("giriş → dashboard → şikayet listesi", async ({ page }) => {
    await page.goto("/giris");
    await page.locator('input[name="phone"]').fill("05000000000");
    await page.locator('input[name="password"]').fill("admin123");
    await page.getByRole("button", { name: /giriş/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/giris"), { timeout: 15_000 });
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(/dashboard|özet|şikayet/i).first()).toBeVisible();

    await page.goto("/sikayetler");
    await expect(page.locator("h1")).toContainText(/Şikayet Kayıt/i);
  });

  test("görevlendirme sayfası açılır", async ({ page }) => {
    await page.goto("/giris");
    await page.locator('input[name="phone"]').fill("05000000000");
    await page.locator('input[name="password"]').fill("admin123");
    await page.getByRole("button", { name: /giriş/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/giris"), { timeout: 15_000 });
    await page.goto("/gorevler");
    await expect(page.locator("h1")).toContainText(/Görevlendirme/i);
    await expect(page.getByText(/Müdürlük Kullanım Özeti/i)).toBeVisible();
  });
});


