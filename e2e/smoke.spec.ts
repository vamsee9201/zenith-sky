import { expect, test } from "@playwright/test";

test("renders the launch page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Look up." })).toBeVisible();
});

