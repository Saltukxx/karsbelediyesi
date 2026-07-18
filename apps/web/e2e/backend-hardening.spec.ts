import { test, expect } from "@playwright/test";

async function login(page: import("@playwright/test").Page, phone: string, password: string) {
  await page.goto("/giris");
  await page.locator('input[name="phone"]').fill(phone);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /giriş/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/giris"), { timeout: 15_000 });
}

async function apiLogin(
  request: import("@playwright/test").APIRequestContext,
  phone: string,
  password: string,
) {
  const res = await request.post("/api/v1/auth/login", {
    data: { phone, password },
  });
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { token: string };
  return body.token;
}

test.describe("Backend hardening", () => {
  test("manager başka müdürlük şikayet detayına giremez", async ({ page, request }) => {
    const adminToken = await apiLogin(request, "05000000000", "admin123");
    const list = await request.get("/api/v1/complaints?sekme=aktif", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(list.status()).toBe(200);
    const rows = (await list.json()) as { id: string; arayanKisi: string }[];
    const foreign = rows.find((r) => r.arayanKisi === "E2E-DEPT-B");
    expect(foreign).toBeTruthy();

    await login(page, "05000000020", "mudur123");
    await page.goto(`/sikayetler/${foreign!.id}`);
    await expect(page.getByText("E2E-DEPT-B")).toHaveCount(0);
    await expect(page.getByText(/404|bulunamadı|not found/i).first()).toBeVisible({
      timeout: 10_000,
    });

    const mudurToken = await apiLogin(request, "05000000020", "mudur123");
    const apiRes = await request.get(`/api/v1/complaints/${foreign!.id}`, {
      headers: { Authorization: `Bearer ${mudurToken}` },
    });
    expect([403, 404]).toContain(apiRes.status());
  });

  test("mobil complaints listesi müdür için E2E-DEPT-B içermez", async ({ request }) => {
    const token = await apiLogin(request, "05000000020", "mudur123");
    const res = await request.get("/api/mobile/complaints", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const rows = (await res.json()) as { arayanKisi: string }[];
    expect(rows.some((r) => r.arayanKisi === "E2E-DEPT-B")).toBe(false);
    expect(rows.some((r) => r.arayanKisi === "E2E-DEPT-A")).toBe(true);
  });

  test("yabancı görev start 403", async ({ request }) => {
    const adminToken = await apiLogin(request, "05000000000", "admin123");
    const vehiclesRes = await request.get("/api/v1/vehicles", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(vehiclesRes.status()).toBe(200);
    const vehicles = (await vehiclesRes.json()) as { id: string }[];
    test.skip(vehicles.length === 0, "Araç yok");

    const created = await request.post("/api/v1/tasks", {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { vehicleId: vehicles[0]!.id, gorevTanimi: "E2E görev" },
    });
    expect(created.status()).toBe(201);
    const task = (await created.json()) as { id: string };

    const ccToken = await apiLogin(request, "05000000010", "cc123");
    const start = await request.patch(`/api/v1/tasks/${task.id}`, {
      headers: { Authorization: `Bearer ${ccToken}` },
      data: { action: "start" },
    });
    expect(start.status()).toBe(403);
  });

  test("geçersiz durum geçişi 400", async ({ request }) => {
    const token = await apiLogin(request, "05000000000", "admin123");
    const create = await request.post("/api/v1/complaints", {
      headers: { Authorization: `Bearer ${token}` },
      data: { arayanKisi: "E2E Status", telefon: "05001110000" },
    });
    expect(create.status()).toBe(201);
    const created = (await create.json()) as { id: string };

    await request.patch(`/api/v1/complaints/${created.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { durum: "KAPATILDI", cozumNotu: "kapandı" },
    });

    const reopenAsCc = await apiLogin(request, "05000000010", "cc123");
    const bad = await request.patch(`/api/v1/complaints/${created.id}`, {
      headers: { Authorization: `Bearer ${reopenAsCc}` },
      data: { durum: "ACIK" },
    });
    expect(bad.status()).toBe(400);
  });
});
