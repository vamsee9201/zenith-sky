import { expect, test } from "@playwright/test";

test("renders the phone-first sky interface and denied-location fallback", async ({ page }) => {
  await page.route("**/api/catalog", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ updatedAt: new Date().toISOString(), stale: false, objects: [] }),
  }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What's up there?" })).toBeVisible();
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.getByText(/manual coordinates remain active/i)).toBeVisible();
  await expect(page.getByRole("img", { name: /North-up sky dome/ })).toBeVisible();
});

test("uses and remembers a granted browser location", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"], { origin: "http://127.0.0.1:3100" });
  await context.setGeolocation({ latitude: 32.71574, longitude: -117.16109 });
  await page.route("**/api/catalog", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ updatedAt: new Date().toISOString(), stale: false, objects: [] }),
  }));
  await page.goto("/");
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.getByText("Current location")).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh location" })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("zenith-observer-v1") ?? "null"))).toMatchObject({
    version: 3,
    observer: { latitude: 32.71574, longitude: -117.16109 },
    source: "device",
  });
});

test("stages and saves a static city-center location", async ({ page }) => {
  await page.route("**/api/catalog", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ updatedAt: new Date().toISOString(), stale: false, objects: [] }),
  }));
  await page.goto("/");
  await page.getByText("Choose a city or enter coordinates").click();
  await page.getByLabel("U.S. city").selectOption("san-francisco-ca");
  await expect(page.getByLabel("Latitude")).toHaveValue("37.7749");
  await expect(page.getByText("Los Angeles fallback")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("zenith-observer-v1"))).toBeNull();

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("San Francisco, CA city center", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("zenith-observer-v1") ?? "null"))).toMatchObject({
    version: 3,
    source: "city",
    cityId: "san-francisco-ca",
  });
});

test("publishes a standalone web app manifest", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest).toMatchObject({ name: "Zenith Sky", display: "standalone", start_url: "/" });
});
