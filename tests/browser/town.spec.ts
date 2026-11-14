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

test("projects change the world without paid ticks, and the recap leads to a citizen", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let tickRequests = 0;
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/tick") tickRequests++;
  });
  await page.goto("/");
  await expect(page.getByText("Private demo", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pause simulation" }).click();
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("little-civilization-demo-v1")!),
  );
  await page
    .getByRole("button", { name: "Shape the town", exact: true })
    .click();
  const library = page.locator(".project-option").filter({
    has: page.getByRole("heading", { name: "Commission the library" }),
  });
  await library.getByRole("button").click();
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("little-civilization-demo-v1")!),
  );
  expect(after.construction).toBe(before.construction + 25);
  expect(after.gold).toBe(before.gold - 60);
  expect(after.wood).toBe(before.wood - 40);
  expect(after.tick).toBe(before.tick);
  expect(tickRequests).toBe(0);
  await page.getByRole("button", { name: "Close projects" }).click();
  await page.getByRole("button", { name: "Open tick recap" }).click();
  await expect(
    page.getByRole("dialog", { name: "What happened this tick" }),
  ).toBeVisible();
  await expect(page.locator(".decision-list>button")).toHaveCount(20);
  await page.locator(".decision-list>button").first().click();
  await expect(
    page.getByRole("heading", { name: "Milo", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Stop following" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("completed projects change the 3D scene and festivals gather the town", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("Private demo", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pause simulation" }).click();
  // Represent a town that has stockpiled materials and nearly finished its library.
  await page.evaluate(() => {
    const w = JSON.parse(localStorage.getItem("little-civilization-demo-v1")!);
    w.wood = 220;
    w.construction = 80;
    localStorage.setItem("little-civilization-demo-v1", JSON.stringify(w));
  });
  await page.reload();
  await expect(page.getByText("Private demo", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Shape the town", exact: true })
    .click();
  await page
    .locator(".project-option")
    .filter({
      has: page.getByRole("heading", { name: "Commission the library" }),
    })
    .getByRole("button")
    .click();
  await page
    .locator(".project-option")
    .filter({
      has: page.getByRole("heading", { name: "Expand Sunfield Farm" }),
    })
    .getByRole("button")
    .click();
  await page
    .locator(".project-option")
    .filter({
      has: page.getByRole("heading", { name: "Throw a town festival" }),
    })
    .getByRole("button")
    .click();
  await page.getByRole("button", { name: "Close projects" }).click();
  await expect(page.getByText("Town library · open to everyone")).toBeVisible();
  await expect(
    page.getByText("Expanded farm · +6 food per farmer"),
  ).toBeVisible();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("little-civilization-demo-v1")!),
  );
  expect(state.construction).toBe(100);
  expect(
    state.citizens.every((c: { playerDirected: boolean }) => c.playerDirected),
  ).toBe(true);
  expect(state.upgrades).toContain("farm");
  await page.waitForTimeout(800);
  await page.screenshot({ path: "test-results/town-projects-complete.png" });
  expect(errors).toEqual([]);
});
