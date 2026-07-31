import { test as setup, expect } from "@playwright/test";
import { KULLANICILAR, OTURUM, type RolAnahtari } from "./auth-states";

/**
 * Rol başına bir kez giriş yapıp oturum çerezini diske yazar.
 * Giriş uç noktası (ip, telefon) başına 15 dk'da 10 denemeyle sınırlı;
 * her testin yeniden giriş yapması sınırı aşıp suite'i kırıyordu.
 */
for (const anahtar of Object.keys(KULLANICILAR) as RolAnahtari[]) {
  const kullanici = KULLANICILAR[anahtar];
  setup(`${anahtar} oturumu hazırla`, async ({ page }) => {
    await page.goto("/giris");
    await page.locator('input[name="phone"]').fill(kullanici.phone);
    await page.locator('input[name="password"]').fill(kullanici.password);
    await page.getByRole("button", { name: /giriş/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/giris"), {
      timeout: 15_000,
    });
    await expect(page.locator("body")).toBeVisible();
    await page.context().storageState({ path: OTURUM[anahtar] });
  });
}
