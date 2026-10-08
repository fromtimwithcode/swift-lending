import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ timezoneId: "America/Chicago" });

const investmentLabel = "$100,000 investment at 10%";

async function openPage(page: Page, name: string) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date("2027-01-05T18:00:00.000Z"));
  await page.goto(`/?page=${name}`);
  await page.evaluate(() => document.fonts.ready);
  return errors;
}

async function expectNoAxeViolations(page: Page, selector?: string) {
  await page.evaluate(() =>
    Promise.allSettled(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished),
    ),
  );
  const builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]);
  const results = await (selector ? builder.include(selector) : builder).analyze();
  expect(
    results.violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => node.html),
    })),
  ).toEqual([]);
}

const calls = (page: Page) => page.evaluate(() => window.statusTest.calls);

test("admin sees the calculated schedule with dates in the picked calendar day", async ({ page }) => {
  const errors = await openPage(page, "investor");
  const card = page.getByRole("article", { name: investmentLabel });
  await expect(card.getByRole("heading", { name: "$100,000 at 10%" })).toBeVisible();
  await expect(card).toContainText("Started 10/12/2026 · paid monthly on the 12th");
  await expect(card).toContainText("$833.33 past due since 12/12/2026");
  await expect(card.getByText("Due 01/12/2027")).toBeVisible();
  await expect(card).toContainText("Interest earned$2,311.82Since inception");
  await expect(card).toContainText("Paid to date$833.33$1,478.49 earned, not yet paid");
  await expect(card).toContainText("Notes: Wire from First Bank");
  await expectNoAxeViolations(page);
  expect(errors).toEqual([]);
});

test("recording a payment requires an amount and clears the past-due balance", async ({ page }) => {
  const errors = await openPage(page, "investor");
  const trigger = page.getByRole("button", { name: "Record payment" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Record investor payment" });
  const amount = dialog.getByRole("spinbutton", { name: "Amount" });
  await expect(amount).toBeFocused();
  await expect(amount).toHaveValue("833.33");
  await expect(dialog.getByRole("button", { name: "Date paid" })).toHaveText("Jan 5, 2027");
  await expectNoAxeViolations(page, '[role="dialog"]');

  await amount.fill("");
  await dialog.getByRole("button", { name: "Record payment" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Enter a payment amount greater than $0.");
  await expect(amount).toBeFocused();
  expect(await calls(page)).toEqual([]);

  await amount.fill("833.33");
  await dialog.getByRole("combobox", { name: "Method" }).selectOption("wire");
  await dialog.getByRole("textbox", { name: /Reference/ }).fill("  Fed ref 4471  ");
  await dialog.getByRole("button", { name: "Record payment" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Payment recorded")).toBeVisible();
  expect(await calls(page)).toEqual([
    {
      name: "investments:recordPayout",
      args: {
        investmentId: "investment-1",
        amount: 833.33,
        paidDate: Date.UTC(2027, 0, 5),
        method: "wire",
        notes: "Fed ref 4471",
      },
    },
  ]);
  const card = page.getByRole("article", { name: investmentLabel });
  await expect(card.getByText(/past due/)).toHaveCount(0);
  await expect(card).toContainText("Paid to date$1,666.66");
  await expect(trigger).toBeFocused();
  expect(errors).toEqual([]);
});

test("adding an investment defaults the first payment to one month after inception", async ({ page }) => {
  await openPage(page, "investor");
  await page.getByRole("button", { name: "Add investment" }).click();
  const dialog = page.getByRole("dialog", { name: "Add investment" });
  await dialog.getByRole("button", { name: "Add investment" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Enter an investment amount greater than $0.");

  await dialog.getByRole("spinbutton", { name: "Amount" }).fill("50000");
  await dialog.getByRole("spinbutton", { name: "Annual rate (%)" }).fill("12");
  await dialog.getByRole("button", { name: "Inception date" }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "First payment date" })).toHaveText("Feb 5, 2027");
  await expect(dialog).toContainText("$500 a month, paid on the 5th.");

  await dialog.getByRole("button", { name: "Add investment" }).click();
  await expect(dialog).toHaveCount(0);
  expect(await calls(page)).toEqual([
    {
      name: "investments:create",
      args: {
        investorId: "loan-1",
        investmentAmount: 50_000,
        interestRate: 12,
        inceptionDate: Date.UTC(2027, 0, 5),
        firstPaymentDate: Date.UTC(2027, 1, 5),
        priorPaymentsReceived: 0,
      },
    },
  ]);
  const card = page.getByRole("article", { name: "$50,000 investment at 12%" });
  await expect(card).toContainText("Started 01/05/2027 · paid monthly on the 5th");
  await expect(card.getByText("Due 02/05/2027")).toBeVisible();
});

test("a first payment that is not a full month away shows the prorated amount", async ({ page }) => {
  await openPage(page, "investor");
  await page.getByRole("button", { name: `Edit ${investmentLabel}` }).click();
  const dialog = page.getByRole("dialog", { name: "Edit investment" });
  await expect(dialog).toContainText("$833.33 a month, paid on the 12th.");
  await page.evaluate(() =>
    window.statusTest.setInvestments([
      {
        _id: "investment-1",
        investmentAmount: 100_000,
        interestRate: 10,
        inceptionDate: Date.UTC(2026, 9, 12),
        firstPaymentDate: Date.UTC(2026, 10, 1),
        priorPaymentsReceived: 0,
        payouts: [],
      },
    ]),
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: `Edit ${investmentLabel}` }).click();
  await expect(dialog).toContainText("$833.33 a month, paid on the 1st. The first payment is prorated to $555.56.");
});

test("editing saves every term and returns focus to the edit button", async ({ page }) => {
  await openPage(page, "investor");
  const trigger = page.getByRole("button", { name: `Edit ${investmentLabel}` });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Edit investment" });
  await expect(dialog.getByRole("button", { name: "Inception date" })).toHaveText("Oct 12, 2026");
  await dialog.getByRole("spinbutton", { name: "Annual rate (%)" }).fill("12");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toHaveCount(0);
  expect(await calls(page)).toEqual([
    {
      name: "investments:update",
      args: {
        id: "investment-1",
        investmentAmount: 100_000,
        interestRate: 12,
        inceptionDate: Date.UTC(2026, 9, 12),
        firstPaymentDate: Date.UTC(2026, 10, 12),
        priorPaymentsReceived: 0,
        notes: "Wire from First Bank",
      },
    },
  ]);
  await expect(page.getByRole("heading", { name: "$100,000 at 12%" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit $100,000 investment at 12%" })).toBeFocused();
});

test("an investment with payments can't be deleted until its payments are", async ({ page }) => {
  await openPage(page, "investor");
  await page.getByRole("button", { name: `Delete ${investmentLabel}` }).click();
  const confirm = page.getByRole("dialog", { name: "Delete this investment?" });
  await expect(confirm).toContainText("Delete this investment's recorded payments first.");
  await expect(confirm.getByRole("button", { name: "Delete" })).toBeDisabled();
  await confirm.getByRole("button", { name: "Cancel" }).click();

  await page.getByText("Payment history (1)").click();
  await page.getByRole("button", { name: "Delete $833.33 payment from 11/12/2026" }).click();
  await page.getByRole("dialog", { name: "Delete this payment?" }).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Payment deleted")).toBeVisible();
  expect(await calls(page)).toEqual([{ name: "investments:removePayout", args: { id: "payout-1" } }]);
  await expect(page.getByText(/^Payment history/)).toHaveCount(0);
});

test("the investor portal shows earnings, the next payment, and payment history", async ({ page }) => {
  const errors = await openPage(page, "portfolio");
  await expect(page.getByText("Interest Earned", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("$2,311.82").first()).toBeVisible();
  await expect(page.getByText("Due 01/12/2027")).toBeVisible();
  await expect(page.getByRole("cell", { name: "10/12/2026" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "$833.33 on 01/12/2027" })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.goto("/?page=investor-payments");
  await expect(page.getByText("$833.33 paid monthly on the 12th")).toBeVisible();
  const history = page.getByRole("region", { name: "Payment history" });
  await expect(history.getByRole("row")).toHaveCount(2);
  await expect(history.getByRole("row").nth(1)).toContainText("11/12/2026$833.33$100,000 at 10%ACHConfirmation 88214");
  await expectNoAxeViolations(page);

  await page.goto("/?page=investor-statements");
  await expect(page.getByRole("cell", { name: "$10,000" })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const [width, height] of [
  [320, 568],
  [844, 390],
  [1280, 900],
]) {
  test(`investor page and payment dialog fit at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openPage(page, "investor");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Add investment" }).click();
    const dialog = page.getByRole("dialog");
    const rect = (await dialog.boundingBox())!;
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1);
    expect(rect.y + rect.height).toBeLessThanOrEqual(height + 1);
    await expect(dialog.getByRole("button", { name: "Add investment" })).toBeInViewport();
  });
}
