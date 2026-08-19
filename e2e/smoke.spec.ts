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

test("publishes a standalone web app manifest", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest).toMatchObject({ name: "Zenith Sky", display: "standalone", start_url: "/" });
});
