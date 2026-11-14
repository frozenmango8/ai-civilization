import { test, expect } from "@playwright/test";
test("production 3D town renders and free demo controls, inspection, persistence work", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("Private demo", { exact: true })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => {
    const c = document.querySelector("canvas");
    const gl = c?.getContext("webgl2");
    return !!gl && gl.getParameter(gl.VERSION).includes("WebGL");
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "test-results/town-desktop.png" });
  await page.getByRole("button", { name: "Pause simulation" }).click();
  await expect(page.getByText("Taking a breath")).toBeVisible();
  await page.getByRole("button", { name: "Citizens 20" }).click();
  await page.getByRole("button", { name: /Milo Farmer/ }).click();
  await expect(
    page.getByRole("heading", { name: "Milo", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Follow citizen", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop following" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close inspection" }).click();
  await page.getByRole("button", { name: "Advance one tick" }).click();
  const tick = await page.evaluate(
    () => JSON.parse(localStorage.getItem("little-civilization-demo-v1")!).tick,
  );
  expect(tick).toBe(2);
  await page.getByRole("button", { name: "Open town settings" }).click();
  await expect(
    page.getByRole("dialog", { name: "Town settings" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save snapshot" }).click();
  await page.getByRole("button", { name: "Close settings" }).click();
  await page.getByRole("button", { name: "Advance one tick" }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("little-civilization-demo-v1")!).tick,
    ),
  ).toBe(3);
  await page.getByRole("button", { name: "Open town settings" }).click();
  await page.getByRole("button", { name: "Load & pause" }).click();
  await page.getByRole("button", { name: "Close settings" }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("little-civilization-demo-v1")!).tick,
    ),
  ).toBe(2);
  await page.reload();
  await expect(page.getByText("Taking a breath")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("little-civilization-demo-v1")!).tick,
    ),
  ).toBe(2);
  expect(errors).toEqual([]);
});
test("mobile scene and settings fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("Private demo", { exact: true })).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "test-results/town-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open citizen list" }).click();
  await expect(
    page.getByRole("heading", { name: "Meet the neighbors" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close citizen list" }).click();
  await page.getByRole("button", { name: "Open town settings" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
