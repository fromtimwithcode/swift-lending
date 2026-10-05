import { test, expect, type Page } from "@playwright/test";

const finalDrawLoan = {
  status: "funded",
  drawFundsTotal: 62_400,
  drawFundsUsed: 58_077.79,
};
const approvedDraws = [
  { amountRequested: 4_806.29, wireDate: "06/30/2026" },
  { amountRequested: 8_730.71, wireDate: "07/30/2026" },
  { amountRequested: 4_892.65, wireDate: "08/17/2026" },
  { amountRequested: 6_509.79, wireDate: "08/31/2026" },
  { amountRequested: 33_138.35, wireDate: "09/03/2026" },
].map((draw, index) => ({
  ...draw,
  _id: `draw-${index + 1}`,
  _creationTime: 1789603200000 + index,
  loanId: "loan-1",
  borrowerId: "borrower-1",
  workDescription: `Phase ${index + 1}`,
  status: "approved",
}));

async function openFinalDrawLoan(page: Page, path: string) {
  await page.goto(path);
  await page.evaluate(
    ([loan, draws]) => {
      window.statusTest.setLoan(loan as Parameters<typeof window.statusTest.setLoan>[0]);
      window.statusTest.setDraws(draws);
    },
    [finalDrawLoan, approvedDraws] as const,
  );
}

for (const { name, path, mutation, openLabel, submitLabel } of [
  {
    name: "admin",
    path: "/",
    mutation: "draws:createManualDrawRequest",
    openLabel: "New Draw",
    submitLabel: "Create Draw",
  },
  {
    name: "borrower",
    path: "/?page=borrower",
    mutation: "borrower:submitDrawRequest",
    openLabel: "Request Draw",
    submitLabel: "Submit Request",
  },
]) {
  test(`${name} can request the exact remaining draw balance`, async ({ page }) => {
    await openFinalDrawLoan(page, path);
    await page.getByRole("button", { name: openLabel, exact: true }).click();
    const form = page.locator("form[id$='-inline-draw-form']");
    await expect(form.getByText("$4,322.21", { exact: true })).toBeVisible();
    const amount = form.locator("input[type=number]");
    await amount.fill("4322.21");
    await form.locator("textarea").fill("Final phase");
    expect(await amount.evaluate((input: HTMLInputElement) => input.validationMessage)).toBe("");
    await form.getByRole("button", { name: submitLabel, exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => window.statusTest.calls))
      .toEqual([
        {
          name: mutation,
          args: { loanId: "loan-1", amountRequested: 4322.21, workDescription: "Final phase" },
        },
      ]);
  });
}
