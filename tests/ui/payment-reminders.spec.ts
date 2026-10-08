import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const aprilDelete = "Delete monthly interest reminder due 04/01/2026 for 1412 N 3rd Street, Wausau, WI, USA";

async function openPage(page: Page, path: string) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
  return errors;
}

test("deletes a payment reminder only after a reason is given", async ({ page }) => {
  const errors = await openPage(page, "/?page=overview");
  await expect(page.getByText("1 pending / 1 closed / 0 returned")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Pending Under Review" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Delete .* reminder due/ })).toHaveCount(3);
  await expect(page.getByText("06/01/2026")).toBeVisible();

  await page.getByRole("button", { name: aprilDelete }).click();
  const dialog = page.getByRole("dialog", { name: "Delete payment reminder" });
  await expect(dialog).toContainText("Monthly interest of $42.83 due 04/01/2026");
  const reason = dialog.getByRole("textbox", { name: "Reason for deleting" });
  await expect(reason).toBeFocused();
  const axe = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);

  await dialog.getByRole("button", { name: "Delete reminder" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Explain why this is being deleted.");
  await expect(reason).toBeFocused();
  expect(await page.evaluate(() => window.statusTest.calls.length)).toBe(0);

  await reason.fill("  Borrower paid by check.\nConfirmed with title.  ");
  await dialog.getByRole("button", { name: "Delete reminder" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Payment reminder deleted")).toBeVisible();
  expect(await page.evaluate(() => window.statusTest.calls)).toEqual([
    {
      name: "loanCharges:deletePaymentReminder",
      args: {
        loanId: "loan-1",
        dueDate: "04/01/2026",
        source: "scheduled_charge",
        chargeId: "charge-april",
        reason: "Borrower paid by check.\nConfirmed with title.",
      },
    },
  ]);
  await expect(page.getByText("04/01/2026")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Delete .* reminder due/ })).toHaveCount(2);
  const card = page.locator('[tabindex="-1"]', {
    has: page.getByRole("heading", { name: "Payment Reminders" }),
  });
  await expect.poll(() => card.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  expect(errors).toEqual([]);
});

test("an estimated monthly payment reminder can be deleted with a reason", async ({ page }) => {
  await openPage(page, "/?page=overview");
  await page
    .getByRole("button", { name: "Delete monthly payment reminder due 06/01/2026 for 1412 N 3rd Street, Wausau, WI, USA" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Delete payment reminder" });
  await expect(dialog).toContainText("No charge is recorded for this estimated payment");
  await dialog.getByRole("textbox", { name: "Reason for deleting" }).fill("Borrower is on a forbearance plan");
  await dialog.getByRole("button", { name: "Delete reminder" }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => window.statusTest.calls.map((call) => call.args))).toEqual([
    {
      loanId: "loan-1",
      dueDate: "06/01/2026",
      source: "monthly_payment",
      reason: "Borrower is on a forbearance plan",
    },
  ]);
  await expect(page.getByText("06/01/2026")).toHaveCount(0);
});

test("loan page deletes a charge with a reason and restores it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await openPage(page, "/");
  await page.evaluate(() =>
    window.statusTest.setCharges(
      [
        { _id: "charge-may", type: "monthly_interest", amount: 2200, periodStart: "04/01/2026", periodEnd: "04/30/2026", dueDate: "05/01/2026", status: "scheduled" },
        { _id: "charge-prepaid", type: "prepaid_interest", amount: 500, periodStart: "03/15/2026", periodEnd: "03/31/2026", dueDate: "03/15/2026", status: "paid" },
      ],
      [{ _id: "payment-1", _creationTime: 1789603200000, amount: 500, paymentDate: "03/15/2026", dueDate: "03/15/2026", method: "wire", status: "on_time", chargeId: "charge-prepaid" }],
    ),
  );
  await expect(page.getByRole("button", { name: "Delete prepaid interest charge due 03/15/2026" })).toBeDisabled();

  const trigger = page.getByRole("button", { name: "Delete monthly interest charge due 05/01/2026" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Delete charge" });
  await expect(dialog).toContainText("Monthly interest of $2,200 due 05/01/2026");
  await dialog.getByRole("button", { name: "Delete charge" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Explain why this is being deleted.");
  expect(await page.evaluate(() => window.statusTest.calls.length)).toBe(0);
  await dialog.getByRole("textbox", { name: "Reason for deleting" }).fill("Charged twice for May");
  await dialog.getByRole("button", { name: "Delete charge" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Charge deleted")).toBeVisible();
  expect(await page.evaluate(() => window.statusTest.calls)).toEqual([
    { name: "loanCharges:removeCharge", args: { id: "charge-may", reason: "Charged twice for May" } },
  ]);
  await expect(trigger).toHaveCount(0);
  const section = page.locator('[tabindex="-1"]', { has: page.getByText("Deleted charges") });
  await expect.poll(() => section.evaluate((element) => element.contains(document.activeElement))).toBe(true);

  await page.getByText("Deleted charges").click();
  await expect(page.getByText("Charged twice for May")).toBeVisible();
  await expect(page.getByText("Deleted by Reviewer on")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Restore monthly interest due 05/01/2026" }).click();
  await expect(page.getByRole("dialog", { name: "Restore this charge?" })).toBeVisible();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByText("Charge restored")).toBeVisible();
  await expect(page.getByText("Deleted charges")).toHaveCount(0);
  await expect(trigger).toBeVisible();
  expect(errors).toEqual([]);
});

test("Escape discards the reason and returns focus to the delete button", async ({ page }) => {
  await openPage(page, "/?page=overview");
  const trigger = page.getByRole("button", { name: aprilDelete });
  await trigger.click();
  await page.getByRole("textbox", { name: "Reason for deleting" }).fill("Draft");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => window.statusTest.calls.length)).toBe(0);
  await trigger.click();
  await expect(page.getByRole("textbox", { name: "Reason for deleting" })).toHaveValue("");
});

for (const [width, height] of [
  [320, 568],
  [844, 390],
  [1280, 900],
]) {
  test(`reminder delete fits at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openPage(page, "/?page=overview");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: aprilDelete }).click();
    const dialog = page.getByRole("dialog");
    const rect = (await dialog.boundingBox())!;
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1);
    expect(rect.y + rect.height).toBeLessThanOrEqual(height + 1);
    await expect(dialog.getByRole("button", { name: "Delete reminder" })).toBeInViewport();
  });
}

test("loan list labels open loans Pending and filters denied loans", async ({ page }) => {
  await openPage(page, "/?page=bulk");
  const tabs = page.getByRole("tablist", { name: "Status filter" });
  await expect(tabs.getByRole("tab")).toHaveText([
    "All2",
    "Pending1",
    "Closed1",
    "Funds Returned0",
    "Denied0",
  ]);
  await expect(page.getByText("Pending", { exact: true }).last()).toBeVisible();

  await page.evaluate(() => window.statusTest.setLoan({ status: "denied" }));
  await expect(tabs.getByRole("tab", { name: "Denied1" })).toBeVisible();
  await tabs.getByRole("tab", { name: "Denied1" }).click();
  await expect(page.getByText("1428 North Prospect Avenue")).toBeVisible();
  await expect(page.getByText("4820 West North Avenue")).toHaveCount(0);
});
