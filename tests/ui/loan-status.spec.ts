import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openPage(page: Page, path = "/") {
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
}
async function noHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function expectDialogFits(page: Page) {
  const dialog = page.getByRole("dialog");
  const rect = await dialog.boundingBox();
  expect(rect).not.toBeNull();
  const viewport = page.viewportSize()!;
  expect(rect!.x).toBeGreaterThanOrEqual(0);
  expect(rect!.y).toBeGreaterThanOrEqual(0);
  expect(rect!.x + rect!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
}

for (const [width, height] of [
  [320, 568],
  [375, 812],
  [390, 844],
  [430, 932],
  [640, 900],
  [768, 1024],
  [844, 390],
  [1024, 768],
  [1280, 900],
  [1440, 900],
  [1920, 1080],
]) {
  test(`status workflow at ${width}×${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await openPage(page);
    const panel = page.getByRole("region", {
      name: "Loan status",
      exact: true,
    });
    await expect(
      panel.getByText("Under Review", { exact: true }),
    ).toBeVisible();
    await noHorizontalOverflow(page);
    const trigger = panel.getByRole("button", {
      name: "Info Needed",
      exact: true,
    });
    await trigger.click();
    const field = page.getByRole("textbox", {
      name: "What information is needed?",
    });
    await expect(field).toBeFocused();
    await expectDialogFits(page);
    await page
      .getByRole("button", { name: "Save status", exact: true })
      .click();
    await expect(page.getByRole("alert")).toHaveText(
      "Describe the information still needed.",
    );
    expect(await page.evaluate(() => window.statusTest.calls.length)).toBe(0);
    await field.fill(
      "Please provide your current insurance policy.\nInclude the property address and coverage dates.",
    );
    if ([320, 390, 768, 1440].includes(width))
      await page.screenshot({
        path: testInfo.outputPath(`dialog-${width}.png`),
      });
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => window.statusTest.calls.length)).toBe(0);
    await trigger.click();
    await expect(field).toHaveValue("");
    await field.fill("Updated insurance policy needed.");
    await page
      .getByRole("button", { name: "Save status", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      panel.getByText("Updated insurance policy needed."),
    ).toBeVisible();
    await panel.getByRole("button", { name: "Approved", exact: true }).click();
    await page
      .getByRole("button", { name: "Save status", exact: true })
      .click();
    await expect(panel.getByText("Approved", { exact: true })).toBeVisible();
    await expect.poll(() => panel.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await expect(
      panel.getByText("Updated insurance policy needed."),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        window.statusTest.calls.map((call) => call.args.status),
      ),
    ).toEqual(["additional_info_needed", "approved"]);
    await noHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });
}

test("keyboard focus stays in the dialog and Escape restores the trigger", async ({
  page,
}) => {
  await openPage(page);
  const trigger = page
    .getByRole("region", { name: "Loan status", exact: true })
    .getByRole("button", { name: "Denied", exact: true });
  await trigger.click();
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press("Tab");
    await expect
      .poll(() =>
        page.evaluate(() =>
          document
            .querySelector('[role="dialog"]')
            ?.contains(document.activeElement),
        ),
      )
      .toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("errors preserve the note; slow saves block duplicates and dismissal", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPage(page);
  await page.evaluate(() => {
    window.statusTest.error = "Connection interrupted. Please try again.";
  });
  await page.getByRole("button", { name: "Denied", exact: true }).click();
  const field = page.getByRole("textbox", { name: "Reason for denial" });
  await field.fill("The property does not meet our lending criteria.");
  await page.getByRole("button", { name: "Save status", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Could not save the status. Please try again.",
  );
  await expect(field).toHaveValue(
    "The property does not meet our lending criteria.",
  );
  await page.screenshot({ path: testInfo.outputPath("error-mobile.png") });
  await page.evaluate(() => {
    window.statusTest.error = "";
    window.statusTest.delay = 1200;
  });
  await page.getByRole("button", { name: "Save status", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("saving-mobile.png") });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => window.statusTest.calls.length)).toBe(2);
});

test("a stale dialog preserves the note and explains the conflict", async ({
  page,
}) => {
  await openPage(page);
  await page.getByRole("button", { name: "Denied", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Reason for denial" })
    .fill("Review details");
  await page.evaluate(() =>
    window.statusTest.setLoan({
      status: "additional_info_needed",
      statusNote: "Insurance",
    }),
  );
  await page.getByRole("button", { name: "Save status", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "while you were reviewing",
  );
  await expect(
    page.getByRole("textbox", { name: "Reason for denial" }),
  ).toHaveValue("Review details");
});

test("bulk dialog validates selection and notes, then identifies partial failures", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openPage(page, "/?page=bulk");
  await page.getByRole("checkbox").first().check();
  await page
    .getByRole("button", { name: "Change Status", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Update 2 loans");
  await expectDialogFits(page);
  await page.getByRole("button", { name: "Update loans", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Choose a new status.");
  await page
    .getByRole("combobox", { name: "New status" })
    .selectOption("denied");
  await page.getByRole("button", { name: "Update loans", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Enter a reason for denying this loan.",
  );
  await page
    .getByRole("textbox", { name: "Reason for denial" })
    .fill("Insufficient collateral.");
  await page.screenshot({ path: testInfo.outputPath("bulk-mobile.png") });
  await page.getByRole("button", { name: "Update loans", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText(
    "Cannot move from Closed to Denied.",
  );
  await expect(page.getByRole("alert")).toContainText("4820 West North Avenue");
  await noHorizontalOverflow(page);
});

test("borrower sees long explanations across viewports and dark mode", async ({
  page,
}, testInfo) => {
  await openPage(page, "/?page=borrower");
  const note = `Please provide the following:\n1. Updated insurance policy.\n2. Revised construction budget.\nReference: ${"A".repeat(250)}`;
  await page.evaluate(
    (statusNote) =>
      window.statusTest.setLoan({
        status: "additional_info_needed",
        statusNote,
      }),
    note,
  );
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole("heading", { name: "Information needed", exact: true }),
    ).toBeVisible();
    await noHorizontalOverflow(page);
    if ([390, 1440].includes(width))
      await page.screenshot({
        path: testInfo.outputPath(`borrower-${width}.png`),
      });
  }
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.setViewportSize({ width: 390, height: 844 });
  await noHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("borrower-dark.png") });
});

test("borrower timeline stays on the step a held loan reached", async ({ page }) => {
  await openPage(page, "/?page=borrower");
  const current = page.locator('[aria-current="step"]');
  await page.evaluate(() =>
    window.statusTest.setLoan({
      status: "additional_info_needed",
      statusNote: "Upload the renewed insurance policy.",
      progressStatus: "funded",
    }),
  );
  await expect(current).toContainText("Funded");
  await expect(page.getByText("Additional information has been requested")).toBeVisible();
  await page.evaluate(() => window.statusTest.setLoan({ progressStatus: undefined }));
  await expect(current).toContainText("Under Review");
});

test("dark mode, reduced motion, and maximum-length explanations", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 568 });
  await openPage(page);
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.getByRole("button", { name: "Info Needed", exact: true }).click();
  await page
    .getByRole("textbox", { name: "What information is needed?" })
    .fill("Details ".repeat(250));
  await expect(page.getByText("2,000 / 2,000", { exact: true })).toBeVisible();
  await expectDialogFits(page);
  await expect(
    page.getByRole("button", { name: "Save status", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("dark-small.png") });
});

for (const theme of ["light", "dark"]) {
  test(`status controls and dialog accessibility in ${theme} mode`, async ({
    page,
  }) => {
    await openPage(page);
    if (theme === "dark")
      await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.evaluate(() =>
      window.statusTest.setLoan({
        status: "additional_info_needed",
        statusNote: "Please upload your current insurance policy.",
      }),
    );
    await page.evaluate(() =>
      Promise.allSettled(
        document
          .getAnimations()
          .filter((animation) => animation instanceof CSSTransition)
          .map((animation) => animation.finished),
      ),
    );
    const controls = await new AxeBuilder({ page })
      .include('[aria-label="Loan status"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(controls.violations).toEqual([]);
    await page.getByRole("button", { name: "Denied", exact: true }).click();
    await page
      .getByRole("button", { name: "Save status", exact: true })
      .click();
    const dialog = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(dialog.violations).toEqual([]);
  });
}


test("activity history exposes the full multiline explanation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPage(page, "/?page=activity");
  const disclosure = page.locator("summary").filter({ hasText: "Changed status" });
  await disclosure.click();
  await expect(page.getByText("Explanation: Please upload an updated insurance policy.", { exact: false })).toBeVisible();
  await expect(page.getByText("Include the property address and coverage dates.", { exact: false })).toBeVisible();
  await noHorizontalOverflow(page);
});
