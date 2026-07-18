import { test, expect } from "@playwright/test";

async function login(page: import("@playwright/test").Page, phone: string, password: string) {
  await page.goto("/giris");
  await page.locator('input[name="phone"]').fill(phone);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /giriş/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/giris"), { timeout: 15_000 });
}

test.describe("Web panel güçlendirme", () => {
  test("admin şikayet oluşturur", async ({ page }) => {
    await login(page, "05000000000", "admin123");
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/sikayetler/yeni");
    await page.locator('input[name="arayanKisi"]').fill("E2E Vatandaş");
    await page.locator('input[name="telefon"]').fill("05009998877");
    await page.getByRole("button", { name: "Kaydet" }).click();
    await expect(page).toHaveURL(/\/sikayetler\/(?!yeni)/, { timeout: 15_000 });
    await expect(page.getByText("E2E Vatandaş").first()).toBeVisible();
  });

  test("CALL_CENTER filo ve tanımlara giremez", async ({ page }) => {
    await login(page, "05000000010", "cc123");
    await page.goto("/tanimlar");
    await expect(page).not.toHaveURL(/\/tanimlar/);
    await page.goto("/araclar");
    await expect(page).not.toHaveURL(/\/araclar/);
  });

  test("DEPARTMENT_MANAGER başka müdürlük şikayetini görmez", async ({ page }) => {
    await login(page, "05000000020", "mudur123");
    await page.goto("/sikayetler?sekme=tumu");
    await expect(page.getByText("E2E-DEPT-A")).toBeVisible();
    await expect(page.getByText("E2E-DEPT-B")).toHaveCount(0);
  });

  test("whatsapp kuyruk API 200 döner (admin)", async ({ page, request }) => {
    await login(page, "05000000000", "admin123");
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const res = await request.get("/api/ops/whatsapp-queue", {
      headers: { cookie: cookieHeader },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("pendingCount");
  });

  test("raporlar SLA bölümü görünür", async ({ page }) => {
    await login(page, "05000000000", "admin123");
    await page.goto("/raporlar");
    await expect(page.getByText(/Şikayet SLA/i)).toBeVisible();
    await expect(page.getByText(/Müdürlük KPI/i)).toBeVisible();
  });

  test("şikayet listesinde sayfalama parametresi çalışır", async ({ page }) => {
    await login(page, "05000000000", "admin123");
    await page.goto("/sikayetler?sekme=tumu&page=1");
    await expect(page.locator("h1")).toContainText(/Şikayet Kayıt/i);
    await page.goto("/sikayetler?sekme=tumu&page=2");
    await expect(page.locator("h1")).toContainText(/Şikayet Kayıt/i);
  });
});

