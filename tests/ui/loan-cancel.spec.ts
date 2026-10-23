import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openPage(page: Page, path = "/") {
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
}
async function noHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
}

for (const [width, height] of [
  [320, 568],
  [390, 844],
  [844, 390],
  [1280, 900],
]) {
  test(`borrower cancels an application at ${width}×${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await openPage(page, "/?page=borrower");
    const progress = page.getByRole("region", { name: "Loan progress" });
    const trigger = progress.getByRole("button", { name: "Cancel application" });
    await noHorizontalOverflow(page);

    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Cancel this application?" });
    await expect(dialog.getByRole("textbox", { name: "Anything else we should know?" })).toBeFocused();
    await dialog.getByRole("button", { name: "Keep application" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => window.statusTest.calls.length)).toBe(0);

    await trigger.click();
    const reason = dialog.getByRole("button", { name: "Deal fell through" });
    await reason.click();
    await expect(reason).toHaveAttribute("aria-pressed", "true");
    await dialog
      .getByRole("textbox", { name: "Anything else we should know?" })
      .fill("The seller accepted a backup offer.");
    await expect(dialog.getByRole("button", { name: "Cancel application" })).toBeInViewport();
    if (width === 390) await page.screenshot({ path: testInfo.outputPath("borrower-cancel-dialog.png") });
    await dialog.getByRole("button", { name: "Cancel application" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(progress.getByText("This loan application was canceled")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Reason for canceling" })).toBeVisible();
    await expect(page.getByText("The seller accepted a backup offer.")).toBeVisible();
    await expect(progress.getByRole("button", { name: "Cancel application" })).toHaveCount(0);
    await expect(progress).toBeFocused();
    expect(await page.evaluate(() => window.statusTest.calls)).toEqual([
      {
        name: "borrower:cancelApplication",
        args: { id: "loan-1", note: "Deal fell through\n\nThe seller accepted a backup offer." },
      },
    ]);
    await noHorizontalOverflow(page);
  });
}

test("borrowers cannot cancel funded, denied, or drawn loans", async ({ page }) => {
  await openPage(page, "/?page=borrower");
  const button = page.getByRole("button", { name: "Cancel application" });
  await expect(button).toBeVisible();
  for (const patch of [
    { status: "funded" },
    { status: "denied" },
    { status: "approved", drawFundsUsed: 5000 },
  ] as const) {
    await page.evaluate((next) => window.statusTest.setLoan(next), patch);
    await expect(button).toHaveCount(0);
  }
  await page.evaluate(() => window.statusTest.setLoan({ status: "approved", drawFundsUsed: undefined }));
  await expect(button).toBeVisible();
});

test("a failed cancel keeps the dialog open with the reason", async ({ page }) => {
  await openPage(page, "/?page=borrower");
  await page.evaluate(() => {
    window.statusTest.error = "Connection interrupted.";
  });
  await page.getByRole("button", { name: "Cancel application" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "No longer needed" }).click();
  await dialog.getByRole("button", { name: "Cancel application" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Could not cancel the application. Please try again.",
  );
  await expect(dialog.getByRole("button", { name: "No longer needed" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("admins cancel with a quick reason and see who canceled", async ({ page }) => {
  await openPage(page);
  const panel = page.getByRole("region", { name: "Loan status", exact: true });
  await panel.getByRole("button", { name: "Canceled", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Duplicate application" }).click();
  await expect(dialog.getByText("21 / 2,000", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Save status", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(panel.getByText("Canceled", { exact: true })).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Reason for canceling" })).toBeVisible();
  await expect(panel.getByText("Duplicate application")).toBeVisible();
  await expect(panel.getByText("The borrower canceled this application.")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Under Review", exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.statusTest.calls.map((call) => call.args))).toEqual([
    { id: "loan-1", status: "canceled", expectedStatus: "under_review", note: "Duplicate application" },
  ]);

  await page.evaluate(() => window.statusTest.setLoan({ statusUpdatedBy: "borrower-1" }));
  await expect(panel.getByText("The borrower canceled this application.")).toBeVisible();

  await page.evaluate(() => window.statusTest.setLoan({ status: "funded" }));
  await expect(panel.getByRole("button", { name: "Canceled", exact: true })).toHaveCount(0);
});

async function settleTransitions(page: Page) {
  await page.evaluate(() =>
    Promise.allSettled(
      document
        .getAnimations()
        .filter((animation) => animation instanceof CSSTransition)
        .map((animation) => animation.finished),
    ),
  );
}

async function useDarkMode(page: Page) {
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await settleTransitions(page);
}

// The existing timeline step labels (gold current step, 50% future steps) predate this
// feature and fail color contrast; the banner and cancel controls are still checked.
const TIMELINE_STEPS = '[aria-label="Loan progress"] > .w-full > :last-child';

for (const theme of ["light", "dark"]) {
  test(`cancel dialogs are accessible in ${theme} mode`, async ({ page }) => {
    await openPage(page, "/?page=borrower");
    if (theme === "dark") await useDarkMode(page);
    const progress = await new AxeBuilder({ page })
      .include('[aria-label="Loan progress"]')
      .exclude(TIMELINE_STEPS)
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(progress.violations).toEqual([]);
    await page.getByRole("button", { name: "Cancel application" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Found other financing" }).click();
    await settleTransitions(page);
    const borrowerDialog = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(borrowerDialog.violations).toEqual([]);
    await page.getByRole("button", { name: "Cancel application" }).last().click();
    await expect(page.getByText("This loan application was canceled")).toBeVisible();
    const canceled = await new AxeBuilder({ page })
      .include('[aria-label="Loan progress"]')
      .exclude(TIMELINE_STEPS)
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(canceled.violations).toEqual([]);

    await openPage(page);
    if (theme === "dark") await useDarkMode(page);
    await page.getByRole("button", { name: "Canceled", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Borrower withdrew" }).click();
    await settleTransitions(page);
    const adminDialog = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(adminDialog.violations).toEqual([]);
  });
}
