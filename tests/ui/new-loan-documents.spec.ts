import { test, expect, type Page } from "@playwright/test";

type Call = { name: string; args: Record<string, unknown> };

async function stubUploads(page: Page) {
  let next = 0;
  await page.route("**/__upload", (route) =>
    route.fulfill({ json: { storageId: `storage-${++next}` } }),
  );
  await page.route("**/api/places*", (route) => route.abort());
}

const calls = (page: Page, name: string) =>
  page.evaluate(
    (mutation) => window.statusTest.calls.filter((call: Call) => call.name === mutation),
    name,
  );

async function fillProperty(page: Page, prefix: string, propertyType: string) {
  await page.locator(`#${prefix}-strategy`).selectOption("flip_and_resell");
  await page.locator(`#${prefix}-property-type`).selectOption(propertyType);
  await page.locator(`#${prefix}-square-feet-above-grade`).fill("1100");
  await page.locator(`#${prefix}-square-feet-below-grade`).fill("0");
  await page.locator(`#${prefix}-bedrooms`).fill("2");
  await page.locator(`#${prefix}-bathrooms`).fill("2");
  await page.getByPlaceholder("123 Main St, City, State ZIP").fill("20 Contract St, Milwaukee, WI");
}

test("borrower applications require a purchase contract", async ({ page }) => {
  await stubUploads(page);
  await page.goto("/?page=apply");

  await expect(page.locator("#loan-application-property-property-type option", { hasText: "Condo" })).toHaveCount(1);
  await expect(page.getByText("Do you currently have this under contract?")).toHaveCount(0);

  await page.getByPlaceholder("e.g. My LLC").fill("Morgan LLC");
  await fillProperty(page, "loan-application-property", "condo");
  await page.locator('label:has-text("Purchase Price") + input').fill("150000");
  await page.locator("#application-after-repair-value").fill("250000");
  await page.locator("#application-title-company").fill("Test Title");
  await page.locator("#application-title-contact").fill("Title Contact");
  await page.locator("#application-title-contact-email").fill("title@example.com");
  await page.locator("#application-title-contact-phone").fill("555-555-1212");
  await page.getByRole("button", { name: "Desired Close Date" }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.getByRole("button", { name: "Direct to Seller" }).click();
  await page.locator('input[accept=".png,.jpg,.jpeg,.webp"]').setInputFiles({
    name: "front.png", mimeType: "image/png", buffer: Buffer.from("photo"),
  });
  await expect(page.getByText("front.png")).toBeVisible();

  await page.getByRole("button", { name: "Submit Application" }).click();
  await expect(page.getByText("A purchase contract is required")).toBeVisible();
  expect(await calls(page, "borrower:submitApplication")).toHaveLength(0);

  await page
    .locator('div:has(> button:has-text("Upload purchase contract")) > input[type=file]')
    .setInputFiles({ name: "contract.pdf", mimeType: "application/pdf", buffer: Buffer.from("contract") });
  await expect(page.getByText("contract.pdf")).toBeVisible();

  await page.getByRole("button", { name: "Submit Application" }).click();
  await expect.poll(() => calls(page, "borrower:submitApplication")).toHaveLength(1);
  const [{ args }] = await calls(page, "borrower:submitApplication");
  expect(args).toMatchObject({
    propertyType: "condo",
    acquisitionType: "direct_to_seller",
    purchaseContractFiles: [{ storageId: "storage-2", fileName: "contract.pdf", fileSize: 8 }],
  });
  expect(args).not.toHaveProperty("isUnderContract");
  expect(args).not.toHaveProperty("terms");
});

test("borrower applications show the standard loan term instead of a choice", async ({ page }) => {
  await page.goto("/?page=apply");

  await expect(page.getByText("Desired Terms")).toHaveCount(0);
  await page.locator('label:has-text("Purchase Price") + input').fill("150000");
  await expect(page.getByText("Loan Term", { exact: true })).toBeVisible();
  await expect(page.getByText("6 months", { exact: true })).toBeVisible();
});

async function fillNewLoan(page: Page) {
  await page.getByRole("combobox").first().selectOption("borrower-1");
  await fillProperty(page, "new-loan-property", "single_family");
  await page.locator('label:has-text("Purchase Price") + input').fill("150000");
  await page.getByRole("button", { name: "Close Date", exact: true }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.locator("#new-loan-title-company").fill("Test Title");
  await page.locator("#new-loan-title-contact").fill("Title Contact");
  await page.locator("#new-loan-title-contact-email").fill("title@example.com");
  await page.locator("#new-loan-title-contact-phone").fill("555-555-1212");
}

test("admins can create a loan by listing missing documents", async ({ page }) => {
  await stubUploads(page);
  await page.goto("/?page=new-loan");
  await fillNewLoan(page);

  await page.getByRole("button", { name: "Create Loan" }).click();
  await expect(page.getByText("Upload the purchase contract or list the missing documents")).toBeVisible();
  expect(await calls(page, "admin:createLoan")).toHaveLength(0);

  await page.getByLabel("Missing Documents").fill("Missing purchase contract");
  await page.getByRole("button", { name: "Create Loan" }).click();
  await expect.poll(() => calls(page, "admin:createLoan")).toHaveLength(1);
  const [{ args }] = await calls(page, "admin:createLoan");
  expect(args).toMatchObject({
    purchaseContractFiles: [],
    missingDocumentsNote: "Missing purchase contract",
  });
});

test("admin-created loans show the standard loan term instead of a choice", async ({ page }) => {
  await stubUploads(page);
  await page.goto("/?page=new-loan");
  await fillNewLoan(page);
  await page.getByLabel("Missing Documents").fill("Missing purchase contract");

  const terms = page.getByLabel("Terms", { exact: true });
  await expect(terms).toHaveValue("6 months");
  await expect(terms).not.toBeEditable();

  await page.getByRole("button", { name: "Create Loan" }).click();
  await expect.poll(() => calls(page, "admin:createLoan")).toHaveLength(1);
  const [{ args }] = await calls(page, "admin:createLoan");
  expect(args).not.toHaveProperty("terms");
});

for (const { name, path } of [
  { name: "admin", path: "/" },
  { name: "borrower", path: "/?page=borrower" },
]) {
  test(`${name} loan page shows the missing documents note`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate(() => window.statusTest.setLoan({ missingDocumentsNote: "Missing purchase contract" }));

    await expect(page.getByRole("heading", { name: "Missing documents" })).toBeVisible();
    await expect(page.getByText("Missing purchase contract")).toBeVisible();
    if (name === "borrower") {
      await expect(page.getByRole("button", { name: /Purchase Contract\s*Required/ })).toBeVisible();
    }
  });
}

test("admins set the points percentage on a new loan", async ({ page }) => {
  await stubUploads(page);
  await page.goto("/?page=new-loan");
  await fillNewLoan(page);
  await page.getByLabel("Missing Documents").fill("Missing purchase contract");

  const points = page.getByLabel("Points (%)", { exact: true });
  const pointsEarned = page.getByLabel("Points Earned", { exact: true });
  await expect(points).toHaveValue("3");
  await expect(pointsEarned).toHaveValue("4500");

  await points.fill("");
  await page.getByRole("button", { name: "Create Loan" }).click();
  await expect(page.getByText("Points must be between 0% and 100%")).toBeVisible();
  expect(await calls(page, "admin:createLoan")).toHaveLength(0);

  await points.fill("2.5");
  await expect(pointsEarned).toHaveValue("3750");
  await page.getByRole("button", { name: "Create Loan" }).click();
  await expect.poll(() => calls(page, "admin:createLoan")).toHaveLength(1);
  const [{ args }] = await calls(page, "admin:createLoan");
  expect(args).toMatchObject({ loanAmount: 150000, pointsPercentage: 2.5 });
  expect(args).not.toHaveProperty("pointsEarned");
});

const editableLoan = {
  closeDate: "01/15/2026",
  titleCompany: "Test Title",
  titleCompanyContact: "Title Contact",
  titleCompanyContactEmail: "title@example.com",
  titleCompanyContactPhone: "555-555-1212",
  strategy: "flip_and_resell",
  propertyType: "single_family",
  bedrooms: 3,
  bathrooms: 2,
  squareFeetAboveGrade: 1500,
  squareFeetBelowGrade: 0,
  unitDetails: [],
};

test("admins adjust a loan's points percentage", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((loan) => window.statusTest.setLoan(loan), editableLoan);
  await page.getByRole("button", { name: "Edit", exact: true }).click();

  const points = page.getByLabel("Points (%)", { exact: true });
  const pointsEarned = page.getByLabel("Points Earned", { exact: true });
  await expect(points).toHaveValue("3");
  await expect(pointsEarned).toHaveValue("6600");

  await points.fill("2.5");
  await expect(pointsEarned).toHaveValue("5500");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(() => calls(page, "admin:updateLoan")).toHaveLength(1);
  const [{ args }] = await calls(page, "admin:updateLoan");
  expect(args).toMatchObject({ pointsPercentage: 2.5 });
});

test("saving other loan edits leaves legacy points untouched", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(
    (loan) => window.statusTest.setLoan({ ...loan, pointsEarned: 6567.89 }),
    editableLoan,
  );
  await page.getByRole("button", { name: "Edit", exact: true }).click();

  await expect(page.getByLabel("Points (%)", { exact: true })).toHaveValue("2.99");
  await expect(page.getByLabel("Points Earned", { exact: true })).toHaveValue("6567.89");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(() => calls(page, "admin:updateLoan")).toHaveLength(1);
  const [{ args }] = await calls(page, "admin:updateLoan");
  expect(args.pointsPercentage).toBeUndefined();
});
