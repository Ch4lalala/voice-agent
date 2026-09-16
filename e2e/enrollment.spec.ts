import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const demo = {
  familyCardNumber: "3273000000003210",
  fullName: "Budi Santoso",
  dateOfBirth: "1959-04-12",
  phoneNumber: "081200000123",
} as const;

async function continueWithoutVoice(page: Page) {
  await page.getByRole("button", { name: "Continue Without Voice" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Prepare your documents");
}

async function completeRequirements(page: Page) {
  for (const name of [
    "Identification card available",
    "Family Card available",
    "Active phone number available",
    "Email address available, if applicable",
  ]) {
    await page.getByRole("checkbox", { name: new RegExp(name) }).check();
  }
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Family information");
}

async function completeFamilyInformation(page: Page) {
  await page.getByLabel(/^Family Card Number/).fill(demo.familyCardNumber);
  await page.getByLabel(/^Relationship to participant/).selectOption("self");
  await page.getByLabel(/^Family Card Number/).blur();
  await expect(page.getByLabel(/^Family Card Number/)).toHaveValue(
    "•••• •••• •••• 3210",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Participant information");
}

async function completeParticipantInformation(page: Page) {
  await page.getByLabel(/^Full name/).fill(demo.fullName);
  await page.getByLabel(/^Date of birth/).fill(demo.dateOfBirth);
  await page.getByLabel(/^Phone number/).fill(demo.phoneNumber);
  await page.getByRole("heading", { name: "Tell us about the participant" }).click();
  await expect(page.getByLabel(/^Phone number/)).toHaveValue(
    "•••• •••• 0123",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Choose a healthcare facility",
  );
}

async function completeFacility(page: Page) {
  const facility = page.getByRole("radio", {
    name: /Taman Sari Community Clinic/,
  });
  await facility.click();
  await expect(facility).not.toBeChecked();
  await expect(page.getByRole("heading", { name: "Would you like to select this facility?" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm this facility" }).click();
  await expect(facility).toBeChecked();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Review your information");
}

async function assertAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

async function assertLayout(page: Page) {
  const result = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const visible = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0;
    };
    const clipped = [...document.querySelectorAll<HTMLElement>(".screen-preview *")]
      .filter((element) => visible(element) && !element.classList.contains("sr-only"))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > viewportWidth + 1;
      })
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}`)
      .slice(0, 5);
    const undersized = [...document.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled)")]
      .map((control) => {
        const effectiveTarget = control.closest<HTMLElement>("label") ?? control;
        return { control, rect: effectiveTarget.getBoundingClientRect() };
      })
      .filter(({ control, rect }) => visible(control) && (rect.width < 43 || rect.height < 43))
      .map(({ control, rect }) => `${control.tagName.toLowerCase()}#${control.id}:${Math.round(rect.width)}x${Math.round(rect.height)}`)
      .slice(0, 5);
    return {
      overflow: document.documentElement.scrollWidth - viewportWidth,
      clipped,
      undersized,
    };
  });

  expect(result.overflow).toBeLessThanOrEqual(1);
  expect(result.clipped).toEqual([]);
  expect(result.undersized).toEqual([]);
}

async function tabTo(page: Page, locator: Locator, maximumTabs = 30) {
  for (let count = 0; count < maximumTabs; count += 1) {
    if (await locator.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Keyboard focus did not reach ${await locator.getAttribute("id") ?? "target"}.`);
}

test("completes and resets the deterministic demo without an official request", async ({ page }) => {
  const requests: Array<{ method: string; url: string }> = [];
  page.on("request", (request) => requests.push({ method: request.method(), url: request.url() }));
  await page.goto("/");

  await continueWithoutVoice(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const firstRequirement = page.getByRole("checkbox", { name: /Identification card available/ });
  await expect(firstRequirement).toBeFocused();
  await expect(firstRequirement).toHaveAttribute("aria-invalid", "true");
  await expect(firstRequirement).toHaveAccessibleDescription(/Confirm that an identification card is available/);

  await completeRequirements(page);
  await completeFamilyInformation(page);
  await completeParticipantInformation(page);
  await completeFacility(page);

  await expect(page.getByText("•••• •••• •••• 3210")).toBeVisible();
  await expect(page.getByText("•••• •••• 0123")).toBeVisible();
  await expect(page.getByLabel("Independent prototype disclaimer")).toContainText(
    "not affiliated with, endorsed by, or officially integrated with BPJS Kesehatan",
  );
  await expect(page.locator("main")).not.toContainText(demo.familyCardNumber);
  await expect(page.locator("main")).not.toContainText(demo.phoneNumber);

  const requestsBeforeCompletion = requests.length;
  await page.getByRole("button", { name: "Confirm Demo Completion" }).click();
  await expect(page.getByRole("heading", { name: "Demo completion confirmed" })).toBeFocused();
  expect(requests.slice(requestsBeforeCompletion).filter(({ method }) => method !== "GET")).toEqual([]);
  expect(requests.some(({ url }) => /bpjs|mobile-jkn|official-registration/i.test(url))).toBe(false);

  await page.getByRole("button", { name: "Reset Demo" }).first().click();
  await expect(page.getByText("Reset this demo?")).toBeVisible();
  await page.locator(".reset-confirmation").getByRole("button", { name: "Reset Demo" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome to AksesSuara");
  await continueWithoutVoice(page);
  const resetRequirements = page.getByRole("checkbox");
  await expect(resetRequirements).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) {
    await expect(resetRequirements.nth(index)).not.toBeChecked();
  }
  await resetRequirements.first().check();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome to AksesSuara");
});

test("supports a keyboard-only enrollment journey", async ({ page }) => {
  await page.goto("/");
  const continueManual = page.getByRole("button", { name: "Continue Without Voice" });
  await tabTo(page, continueManual);
  await page.keyboard.press("Enter");

  for (const name of [
    /Identification card available/,
    /Family Card available/,
    /Active phone number available/,
    /Email address available, if applicable/,
  ]) {
    const checkbox = page.getByRole("checkbox", { name });
    await tabTo(page, checkbox);
    await page.keyboard.press("Space");
    await expect(checkbox).toBeChecked();
  }
  const requirementsContinue = page.getByRole("button", { name: "Continue", exact: true });
  await tabTo(page, requirementsContinue);
  await page.keyboard.press("Enter");

  const familyCard = page.getByLabel(/^Family Card Number/);
  await tabTo(page, familyCard);
  await page.keyboard.type(demo.familyCardNumber);
  const relationship = page.getByLabel(/^Relationship to participant/);
  await tabTo(page, relationship);
  await page.keyboard.press("S");
  await expect(relationship).toHaveValue("self");
  const familyContinue = page.getByRole("button", { name: "Continue", exact: true });
  await tabTo(page, familyContinue);
  await page.keyboard.press("Enter");

  const fullName = page.getByLabel(/^Full name/);
  await tabTo(page, fullName);
  await page.keyboard.type(demo.fullName);
  const date = page.getByLabel(/^Date of birth/);
  await tabTo(page, date);
  await page.keyboard.type(demo.dateOfBirth);
  const phone = page.getByLabel(/^Phone number/);
  await tabTo(page, phone);
  await page.keyboard.type(demo.phoneNumber);
  const participantContinue = page.getByRole("button", { name: "Continue", exact: true });
  await tabTo(page, participantContinue);
  await page.keyboard.press("Enter");

  const facility = page.getByRole("radio", { name: /Taman Sari Community Clinic/ });
  await tabTo(page, facility);
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Confirm this facility" })).toBeFocused();
  await page.keyboard.press("Enter");
  const facilityContinue = page.getByRole("button", { name: "Continue", exact: true });
  await tabTo(page, facilityContinue);
  await page.keyboard.press("Enter");

  const complete = page.getByRole("button", { name: "Confirm Demo Completion" });
  await tabTo(page, complete);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Demo completion confirmed" })).toBeFocused();
});

for (const viewport of [
  { width: 320, height: 800 },
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]) {
  test(`has no critical accessibility or layout issues at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await assertAccessible(page);
    await assertLayout(page);
    await continueWithoutVoice(page);
    await assertAccessible(page);
    await assertLayout(page);
    await completeRequirements(page);
    await assertAccessible(page);
    await assertLayout(page);
    await completeFamilyInformation(page);
    await assertAccessible(page);
    await assertLayout(page);
    await completeParticipantInformation(page);
    await assertAccessible(page);
    await assertLayout(page);
    await completeFacility(page);
    await assertAccessible(page);
    await assertLayout(page);
  });
}

test("respects reduced motion and remains usable at 200 percent CSS zoom", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("html")).toHaveCSS("scroll-behavior", "auto");
  await expect(page.locator(".waveform span").first()).toHaveCSS("animation-name", "none");
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await assertLayout(page);
  await expect(page.getByRole("button", { name: "Continue Without Voice" })).toBeVisible();
});

test("permission denial provides an accessible retry path without requesting a token", async ({ page }) => {
  let tokenRequests = 0;
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () => Promise.reject(new DOMException("Denied", "NotAllowedError")),
      },
    });
  });
  page.on("request", (request) => {
    if (request.url().includes("/api/voice/token")) tokenRequests += 1;
  });
  await page.goto("/");
  await page.locator("#welcome-voice-primary").click();
  await expect(page.getByText(/Microphone access was denied/)).toBeVisible();
  await expect(page.locator("#welcome-voice-primary")).toBeFocused();
  await expect(page.locator("#welcome-voice-primary")).toHaveAccessibleName("Retry connection");
  expect(tokenRequests).toBe(0);
  await expect(page.getByRole("button", { name: "Continue Without Voice" })).toBeEnabled();
});
