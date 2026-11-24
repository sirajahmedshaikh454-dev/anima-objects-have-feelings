import { expect, test, type Page } from "@playwright/test";

const PHOTO = "tests/fixtures/photos/coco_000000039769.jpg";
const SHOTS = "docs/screenshots";

async function upload(page: Page) {
  await page.goto("/");
  await page.getByTestId("upload").setInputFiles(PHOTO);
  await expect(page.locator('[data-testid^="bubble-"]').first()).toBeVisible();
  // Lines stream in word by word, then settle.
  await expect(page.locator('[data-testid^="bubble-"] p').first()).toHaveText(/\w+/);
}

const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("upload → detect → objects talk (mock engine)", async ({ page }) => {
  await upload(page);
  await expect(page.getByTestId("provider-badge")).toContainText("mock");
  expect(await page.locator('[data-testid^="bubble-"]').count()).toBeGreaterThan(1);
});

test("bubbles stream word by word", async ({ page }) => {
  await page.goto("/");
  const seen = new Set<string>();
  await page.exposeFunction("__seen", (t: string) => seen.add(t));
  await page.evaluate(() => {
    new MutationObserver(() => document.querySelectorAll('[data-testid^="bubble-"] p').forEach((p) => (window as unknown as { __seen: (t: string) => void }).__seen(p.textContent ?? ""))).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  await page.getByTestId("upload").setInputFiles(PHOTO);
  await expect(page.locator('[data-testid^="bubble-"] p').first()).toHaveText(/\w+/);
  await page.waitForTimeout(1500);
  expect(seen.size).toBeGreaterThan(3); // many partial versions of the text, not one final blob
});

test("live camera mode with a fake webcam", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("start-camera").click();
  await expect(page.locator("video")).toBeVisible();
  await expect(page.locator('[data-testid^="bubble-"]').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Stop camera" })).toBeVisible();
});

test("soul card: traits, mood graph, reply in character", async ({ page }) => {
  await upload(page);
  await page.getByRole("list", { name: "Objects in view" }).getByRole("button").first().click();
  const card = page.getByTestId("soul-card");
  await expect(card).toBeVisible();
  await expect(card.getByRole("list", { name: "Traits" }).getByRole("listitem")).toHaveCount(3);
  await expect(card.getByRole("img", { name: /Mood over time/ })).toBeVisible();
  await card.getByRole("textbox", { name: "Your message" }).fill("You look great today!");
  await card.getByRole("button", { name: "Send" }).click();
  await expect(card.locator("p.bubble")).toHaveText(/\w+/);
  await expect(card.getByText('The human said: "You look great today!"')).toBeVisible();
});

test("diary lists what objects said", async ({ page }) => {
  await upload(page);
  await page.waitForTimeout(1000);
  await page.goto("/diary");
  await expect(page.getByTestId("diary-object").first()).toBeVisible();
  await expect(page.getByText("said").first()).toBeVisible();
});

test("settings: provider status and voice toggle", async ({ page }) => {
  await page.goto("/settings");
  const status = page.getByTestId("provider-status");
  await expect(status).toContainText("mock");
  await expect(status).toContainText("not configured");
  const voice = page.getByTestId("voice-toggle");
  const before = await voice.getAttribute("aria-pressed");
  await voice.click();
  await expect(voice).not.toHaveAttribute("aria-pressed", before ?? "false");
  await voice.click();
});

test.describe("visual checks (Phase 5 EXIT)", () => {
  for (const [name, size] of [["desktop-1440", { width: 1440, height: 900 }], ["mobile-390", { width: 390, height: 844 }]] as const) {
    test(`stage, diary and settings at ${name}`, async ({ page }) => {
      await page.setViewportSize(size);
      await upload(page);
      await page.waitForTimeout(2500); // let bubbles settle and the GSAP tweens finish
      expect(await noHorizontalScroll(page)).toBe(true);
      await page.screenshot({ path: `${SHOTS}/stage-${name}.png` });
      await page.goto("/diary");
      expect(await noHorizontalScroll(page)).toBe(true);
      await page.screenshot({ path: `${SHOTS}/diary-${name}.png`, fullPage: true });
      await page.goto("/settings");
      expect(await noHorizontalScroll(page)).toBe(true);
      await page.screenshot({ path: `${SHOTS}/settings-${name}.png`, fullPage: true });
    });
  }
});
