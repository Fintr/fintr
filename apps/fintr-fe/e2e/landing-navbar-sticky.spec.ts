import { expect, test } from "@playwright/test";

test.describe("Landing page navbar", () => {
  test("stays pinned to the top while the page scrolls", async ({ page }) => {
    await page.goto("/");

    const navbar = page.getByTestId("landing-navbar");
    await expect(navbar).toBeVisible({ timeout: 15000 });
    await expect(navbar).toHaveCSS("position", "fixed");

    const initialTop = await navbar.evaluate(
      (element) => element.getBoundingClientRect().top,
    );
    expect(initialTop).toBeLessThanOrEqual(1);

    await page.mouse.wheel(0, 1600);

    await expect
      .poll(async () => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(400);

    await expect
      .poll(async () => {
        return navbar.evaluate((element) => element.getBoundingClientRect().top);
      })
      .toBeLessThanOrEqual(1);

    const scrolledTop = await navbar.evaluate(
      (element) => element.getBoundingClientRect().top,
    );
    expect(scrolledTop).toBeLessThanOrEqual(1);
    await expect(navbar).toBeInViewport();
  });
});
