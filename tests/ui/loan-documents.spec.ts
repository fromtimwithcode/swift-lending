import { test, expect, type Page } from "@playwright/test";

type Call = { name: string; args: Record<string, unknown> };

async function openPage(page: Page, path = "/") {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let next = 0;
  await page.route("**/__upload", (route) =>
    route.fulfill({ json: { storageId: `storage-${++next}` } }),
  );
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
  return errors;
}

const calls = (page: Page, name: string) =>
  page.evaluate(
    (mutation) => window.statusTest.calls.filter((call: Call) => call.name === mutation),
    name,
  );

const pdf = (name: string) => ({ name, mimeType: "application/pdf", buffer: Buffer.from(name) });

const card = (page: Page, heading: string) =>
  page.locator("div.rounded-xl", { has: page.getByRole("heading", { name: heading, exact: true }) });

test("admins keep several closing statements on a loan", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await openPage(page);
  const statements = card(page, "Closing Statements");
  await expect(statements.getByText("No closing statements yet")).toBeVisible();

  await statements.getByRole("button", { name: "Upload Statement" }).click();
  const dialog = page.getByRole("dialog", { name: "Upload Closing Statements" });
  await expect(dialog.getByRole("combobox")).toHaveValue("closing_statement");
  await expect(dialog.getByLabel("What kind of document?")).toHaveCount(0);
  await dialog
    .locator("input[type=file]")
    .setInputFiles([pdf("buyer-statement.pdf"), pdf("final-statement.pdf")]);
  await dialog.getByRole("button", { name: "Upload 2 Files" }).click();
  await expect(dialog).toHaveCount(0);

  const [{ args }] = await calls(page, "documents:saveDocuments");
  expect(args).toMatchObject({
    loanId: "loan-1",
    documents: [
      { fileName: "buyer-statement.pdf", type: "closing_statement" },
      { fileName: "final-statement.pdf", type: "closing_statement" },
    ],
  });
  await expect(statements.getByText("buyer-statement.pdf")).toBeVisible();
  await expect(statements.getByText("final-statement.pdf")).toBeVisible();
  await expect(statements.getByRole("button", { name: "Add Statement" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await statements.getByRole("button", { name: "Remove buyer-statement.pdf" }).click();
  const confirm = page.getByRole("dialog", { name: "Remove closing statement?" });
  await expect(confirm.getByText('This deletes "buyer-statement.pdf" from the loan.')).toBeVisible();
  await confirm.getByRole("button", { name: "Remove" }).click();
  await expect(statements.getByText("buyer-statement.pdf")).toHaveCount(0);
  await expect(statements.getByText("final-statement.pdf")).toBeVisible();
  expect(await calls(page, "documents:deleteDocument")).toMatchObject([{ args: { id: "document-1" } }]);
  expect(errors).toEqual([]);
});

test("uploading an Other document asks what it is", async ({ page }) => {
  const errors = await openPage(page);
  await card(page, "Documents").getByRole("button", { name: "Upload" }).click();
  const dialog = page.getByRole("dialog", { name: "Upload Documents" });
  const docType = dialog.getByRole("combobox");
  await expect(docType).toHaveValue("other");

  await dialog.locator("input[type=file]").setInputFiles(pdf("binder.pdf"));
  const upload = dialog.getByRole("button", { name: "Upload", exact: true });
  await expect(upload).toBeDisabled();

  await docType.selectOption("receipt");
  await expect(dialog.getByLabel("What kind of document?")).toHaveCount(0);
  await expect(upload).toBeEnabled();
  await docType.selectOption("other");
  await expect(upload).toBeDisabled();

  await dialog.getByLabel("What kind of document?").fill("Insurance binder");
  await upload.click();
  await expect(dialog).toHaveCount(0);

  const [{ args }] = await calls(page, "documents:saveDocuments");
  expect(args.documents).toEqual([
    { fileId: "storage-1", fileName: "binder.pdf", fileSize: 10, type: "other", otherTypeName: "Insurance binder" },
  ]);
  await expect(card(page, "Documents").getByText("Insurance binder", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("borrowers name Other documents in the checklist", async ({ page }) => {
  const errors = await openPage(page, "/?page=borrower");
  const name = page.getByLabel("Other document type");
  const row = page.locator("div.border-b", { has: name }).last();
  const upload = row.getByRole("button", { name: "Upload" });
  await expect(upload).toBeDisabled();

  await name.fill("Appraisal");
  await expect(upload).toBeEnabled();
  await row.locator("input[type=file]").setInputFiles(pdf("appraisal.pdf"));

  await expect.poll(() => calls(page, "documents:saveDocuments")).toHaveLength(1);
  const [{ args }] = await calls(page, "documents:saveDocuments");
  expect(args.documents).toMatchObject([
    { fileName: "appraisal.pdf", type: "other", otherTypeName: "Appraisal" },
  ]);
  await expect(name).toHaveValue("");
  expect(errors).toEqual([]);
});
