import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const companyName = "Lakeshore Title & Escrow of Southeastern Wisconsin";

async function openPage(page: Page, query: string) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/?${query}`);
  await page.evaluate(() => document.fonts.ready);
  return errors;
}

async function noHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
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

for (const [width, height] of [
  [390, 844],
  [1280, 900],
]) {
  test(`lists title companies with wire status at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await openPage(page, "page=title-companies");
    await expect(page.getByRole("heading", { level: 1, name: "Title Companies" })).toBeVisible();
    await expect(page.getByText("2 title companies")).toBeVisible();

    const lakeshore = page.getByRole("row", { name: new RegExp(companyName) });
    const prairie = page.getByRole("row", { name: /Prairie Abstract Co\./ });
    const visible = { useInnerText: true };
    await expect(lakeshore).toContainText("(414) 555-0100", visible);
    if (width < 640) {
      await expect(lakeshore).toContainText("Wire instructions on file", visible);
      await expect(prairie).toContainText("No wire instructions", visible);
    } else {
      await expect(lakeshore.getByText("On file", { exact: true })).toBeVisible();
      await expect(prairie.getByText("Not on file", { exact: true })).toBeVisible();
    }
    expect(
      await page.evaluate(() => {
        const scroller = document.querySelector("table")!.parentElement!;
        return scroller.scrollWidth <= scroller.clientWidth;
      }),
    ).toBe(true);
    await noHorizontalOverflow(page);

    await page.getByRole("searchbox").fill("6085550199");
    await expect(lakeshore).toHaveCount(0);
    await expect(prairie).toBeVisible();
    await noHorizontalOverflow(page);
    await expectNoAxeViolations(page);
    expect(errors).toEqual([]);
  });

  test(`detail page shows contacts and masked wire numbers at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await openPage(page, "page=title-company&id=title-1");
    await expect(page.getByRole("heading", { level: 1, name: companyName })).toBeVisible();

    const details = page.getByRole("region", { name: "Company details" });
    await expect(details.getByRole("link", { name: "(414) 555-0100" })).toHaveAttribute("href", "tel:(414) 555-0100");
    await expect(details).toContainText("777 East Wisconsin Avenue, Suite 1200, Milwaukee, WI 53202");

    const contacts = page.getByRole("region", { name: /Contacts/ });
    const dana = contacts.getByRole("listitem", { name: "Dana Whitfield" });
    await expect(dana).toContainText("Escrow officer");
    await expect(dana.getByRole("link", { name: "(414) 555-0142" })).toHaveAttribute("href", "tel:(414) 555-0142");
    await expect(dana.getByRole("link", { name: "dana.whitfield@lakeshoretitleandescrow.example" })).toHaveAttribute(
      "href",
      "mailto:dana.whitfield@lakeshoretitleandescrow.example",
    );
    await expect(contacts.getByRole("listitem", { name: "Luis Ortega" })).toContainText("Closer");

    const wire = page.getByRole("region", { name: "Wire instructions" });
    await expect(wire).toContainText("First Lakes Bank");
    await expect(wire).toContainText("Lakeshore Title & Escrow Trust Account");
    await expect(wire.getByText("•••• 0021")).toBeVisible();
    await expect(wire.getByText("•••• 9012")).toBeVisible();
    await expect(wire).not.toContainText("021000021");
    await expect(wire).not.toContainText("123456789012");
    await expect(wire).toContainText("Confirm by phone before sending funds.");
    await expect(wire).toContainText("Last changed");
    await expect(wire).toContainText("by Reviewer");

    await noHorizontalOverflow(page);
    await expectNoAxeViolations(page);
    expect(errors).toEqual([]);
  });
}

test("revealing a wire number calls the reveal action", async ({ page }) => {
  const errors = await openPage(page, "page=title-company&id=title-1");
  const wire = page.getByRole("region", { name: "Wire instructions" });
  await wire.getByRole("button", { name: "Show account number" }).click();
  await expect(wire.getByText("123456789012")).toBeVisible();
  await expect(wire.getByRole("button", { name: "Hide account number" })).toHaveAttribute("aria-pressed", "true");
  expect(await calls(page)).toEqual([
    {
      name: "titleCompanyActions:revealWireValue",
      args: { titleCompanyId: "title-1", field: "account_number" },
    },
  ]);
  expect(errors).toEqual([]);
});

test("editing wire instructions with blank numbers keeps the saved ones", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await openPage(page, "page=title-company&id=title-1");
  const wire = page.getByRole("region", { name: "Wire instructions" });
  const trigger = wire.getByRole("button", { name: "Edit" });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Edit wire instructions" });
  await expect(dialog.getByRole("textbox", { name: "Bank name" })).toBeFocused();
  await expect(dialog).toContainText(
    "Leave both numbers blank to keep the saved ones (routing ending 0021, account ending 9012), or enter both to replace them.",
  );
  await expect(dialog.getByRole("textbox", { name: "Routing number" })).toHaveValue("");
  await expectNoAxeViolations(page, '[role="dialog"]');
  await noHorizontalOverflow(page);

  await dialog.getByRole("textbox", { name: "Account number" }).fill("44-55");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Enter both numbers to replace them, or leave both blank.");
  await expect(dialog.getByRole("textbox", { name: "Routing number" })).toBeFocused();
  expect(await calls(page)).toEqual([]);

  await dialog.getByRole("textbox", { name: "Account number" }).fill("");
  await dialog.getByRole("textbox", { name: "Bank name" }).fill("  First Lakes Bank N.A.  ");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Wire instructions updated")).toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await calls(page)).toEqual([
    {
      name: "titleCompanyActions:saveWireInstructions",
      args: {
        titleCompanyId: "title-1",
        bankName: "First Lakes Bank N.A.",
        accountName: "Lakeshore Title & Escrow Trust Account",
        notes: "For further credit to the closing file number.",
      },
    },
  ]);
  expect(errors).toEqual([]);
});

test("adding a contact saves trimmed details and lists them", async ({ page }) => {
  const errors = await openPage(page, "page=title-company&id=title-1");
  const contacts = page.getByRole("region", { name: /Contacts/ });
  await contacts.getByRole("button", { name: "Add contact" }).click();

  const dialog = page.getByRole("dialog", { name: "Add contact" });
  const nameField = dialog.getByRole("textbox", { name: "Name" });
  await expect(nameField).toBeFocused();
  await dialog.getByRole("button", { name: "Add contact" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Enter the contact's name.");
  await expect(nameField).toBeFocused();

  await nameField.fill("  Priya Shah ");
  await dialog.getByRole("textbox", { name: /Role/ }).fill("Post-closing");
  await dialog.getByRole("textbox", { name: /Email/ }).fill("priya@");
  await dialog.getByRole("button", { name: "Add contact" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Enter a valid email address.");

  await dialog.getByRole("textbox", { name: /Email/ }).fill("priya@lakeshoretitleandescrow.example");
  await dialog.getByRole("button", { name: "Add contact" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Contact added")).toBeVisible();
  await expect(contacts.getByRole("listitem", { name: "Priya Shah" })).toContainText("Post-closing");
  expect(await calls(page)).toEqual([
    {
      name: "titleCompanies:upsertContact",
      args: {
        titleCompanyId: "title-1",
        name: "Priya Shah",
        role: "Post-closing",
        email: "priya@lakeshoretitleandescrow.example",
      },
    },
  ]);
  expect(errors).toEqual([]);
});
