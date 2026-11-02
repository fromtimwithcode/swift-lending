/// <reference types="vite/client" />
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { getErrorMessage } from "../lib/errors";
import { MAX_TITLE_COMPANY_CONTACTS } from "./lib/titleCompanies";

const modules = import.meta.glob("./**/*.ts");
const TEST_ENCRYPTION_KEY = "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=";
const ROUTING = "021000021";
const NEW_ROUTING = "011000015";
const ACCOUNT = "123456789012";
const NEW_ACCOUNT = "99887766";

let previousKey: string | undefined;
beforeEach(() => {
  previousKey = process.env.BORROWER_DATA_ENCRYPTION_KEY;
  process.env.BORROWER_DATA_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
});
afterEach(() => {
  if (previousKey === undefined) delete process.env.BORROWER_DATA_ENCRYPTION_KEY;
  else process.env.BORROWER_DATA_ENCRYPTION_KEY = previousKey;
});

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const adminUserId = await ctx.db.insert("users", { email: "admin@example.com" });
    const adminId = await ctx.db.insert("userProfiles", {
      authUserId: adminUserId,
      role: "admin",
      displayName: "Admin User",
      email: "admin@example.com",
      isActive: true,
    });
    const developerUserId = await ctx.db.insert("users", { email: "dev@example.com" });
    await ctx.db.insert("userProfiles", {
      authUserId: developerUserId,
      role: "developer",
      displayName: "Developer User",
      email: "dev@example.com",
      isActive: true,
    });
    const borrowerUserId = await ctx.db.insert("users", { email: "borrower@example.com" });
    await ctx.db.insert("userProfiles", {
      authUserId: borrowerUserId,
      role: "borrower",
      displayName: "Borrower",
      email: "borrower@example.com",
      isActive: true,
    });
    return { adminUserId, adminId, developerUserId, borrowerUserId };
  });
  return {
    t,
    admin: t.withIdentity({ subject: ids.adminUserId }),
    developer: t.withIdentity({ subject: ids.developerUserId }),
    borrower: t.withIdentity({ subject: ids.borrowerUserId }),
    adminId: ids.adminId,
  };
}

async function activity(t: TestConvex<typeof schema>, titleCompanyId: Id<"titleCompanies">) {
  return await t.run(async (ctx) => {
    const entries = await ctx.db
      .query("activityLog")
      .withIndex("by_entityType", (q) => q.eq("entityType", "title_company"))
      .take(100);
    return entries
      .filter((entry) => entry.entityId === titleCompanyId)
      .map(({ action, details, userName }) => ({ action, details, userName }));
  });
}

async function userMessage(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return getErrorMessage(error, "hidden");
  }
  throw new Error("Expected the call to fail");
}

describe("title companies", () => {
  test("admins create, update, list, and get companies", async () => {
    const { t, admin, developer } = await fixture();
    const westId = await admin.mutation(api.titleCompanies.create, {
      name: "  Westside   Title  ",
      phone: " (414) 555-0100 ",
      email: " Closings@Westside.example ",
      address: "200 Main St, Milwaukee, WI",
      notes: "   ",
    });
    const acmeId = await developer.mutation(api.titleCompanies.create, { name: "Acme Title" });

    expect(await admin.query(api.titleCompanies.list, {})).toEqual([
      {
        _id: acmeId,
        name: "Acme Title",
        phone: undefined,
        email: undefined,
        contactCount: 0,
        hasWireInstructions: false,
      },
      {
        _id: westId,
        name: "Westside Title",
        phone: "(414) 555-0100",
        email: "closings@westside.example",
        contactCount: 0,
        hasWireInstructions: false,
      },
    ]);

    await admin.mutation(api.titleCompanies.update, {
      id: westId,
      name: "Westside Title Group",
      email: "orders@westside.example",
      notes: "Prefers email for payoff requests.",
    });
    const company = await admin.query(api.titleCompanies.get, { id: westId });
    expect(company).toEqual({
      _id: westId,
      updatedAt: expect.any(Number),
      name: "Westside Title Group",
      phone: undefined,
      email: "orders@westside.example",
      address: undefined,
      notes: "Prefers email for payoff requests.",
      contacts: [],
      wireInstructions: null,
    });

    const stored = await t.run((ctx) => ctx.db.get("titleCompanies", westId));
    expect(stored?.normalizedName).toBe("westside title group");

    expect(await activity(t, westId)).toEqual([
      { action: "title_company.create", details: 'Added title company "Westside Title"', userName: "Admin User" },
      {
        action: "title_company.update",
        details: 'Updated title company "Westside Title Group" (formerly "Westside Title")\nChanged: Name, Phone, Email, Address, Notes',
        userName: "Admin User",
      },
    ]);
    expect(await activity(t, acmeId)).toEqual([
      { action: "title_company.create", details: 'Added title company "Acme Title"', userName: "Developer User" },
    ]);
  });

  test("rejects duplicate names regardless of case and spacing", async () => {
    const { admin } = await fixture();
    const acmeId = await admin.mutation(api.titleCompanies.create, { name: "Acme Title" });
    const otherId = await admin.mutation(api.titleCompanies.create, { name: "Other Title" });

    expect(await userMessage(admin.mutation(api.titleCompanies.create, { name: " acme   TITLE " }))).toBe(
      'A title company named "acme TITLE" already exists.'
    );
    expect(
      await userMessage(admin.mutation(api.titleCompanies.update, { id: otherId, name: "ACME title" }))
    ).toBe('A title company named "ACME title" already exists.');

    await admin.mutation(api.titleCompanies.update, { id: acmeId, name: "ACME Title" });
    expect((await admin.query(api.titleCompanies.get, { id: acmeId }))?.name).toBe("ACME Title");
  });

  test("validates fields", async () => {
    const { admin } = await fixture();
    expect(
      await userMessage(admin.mutation(api.titleCompanies.create, { name: "Acme", email: "not-an-email" }))
    ).toBe("Enter a valid email address.");
    await expect(admin.mutation(api.titleCompanies.create, { name: "   " })).rejects.toThrow("Name is required");
    await expect(
      admin.mutation(api.titleCompanies.create, { name: "Acme", notes: "x".repeat(2001) })
    ).rejects.toThrow("Notes must be 2000 characters or fewer");
    expect(await admin.query(api.titleCompanies.list, {})).toEqual([]);
  });

  test("non-admins cannot read or change title companies", async () => {
    const { t, admin, borrower } = await fixture();
    const id = await admin.mutation(api.titleCompanies.create, { name: "Acme Title" });

    await expect(borrower.query(api.titleCompanies.list, {})).rejects.toThrow("Requires admin role");
    await expect(borrower.query(api.titleCompanies.get, { id })).rejects.toThrow("Requires admin role");
    await expect(borrower.mutation(api.titleCompanies.create, { name: "Borrower Title" })).rejects.toThrow(
      "Requires admin role"
    );
    await expect(borrower.mutation(api.titleCompanies.remove, { id })).rejects.toThrow("Requires admin role");
    await expect(
      borrower.action(api.titleCompanyActions.saveWireInstructions, {
        titleCompanyId: id,
        bankName: "Bank",
        accountName: "Acme",
        routingNumber: ROUTING,
        accountNumber: ACCOUNT,
      })
    ).rejects.toThrow("Requires admin role");
    await expect(t.query(api.titleCompanies.list, {})).rejects.toThrow("Not authenticated");
  });

  test("contacts can be added, edited, and removed up to the cap", async () => {
    const { t, admin } = await fixture();
    const id = await admin.mutation(api.titleCompanies.create, { name: "Acme Title" });

    const contactId = await admin.mutation(api.titleCompanies.upsertContact, {
      titleCompanyId: id,
      name: " Pat Closer ",
      role: "Escrow officer",
      phone: "414-555-0111",
      email: "Pat@Acme.example",
    });
    await admin.mutation(api.titleCompanies.upsertContact, {
      titleCompanyId: id,
      name: "Alex Admin",
    });
    expect((await admin.query(api.titleCompanies.get, { id }))?.contacts).toEqual([
      { _id: expect.any(String), name: "Alex Admin", role: undefined, phone: undefined, email: undefined },
      { _id: contactId, name: "Pat Closer", role: "Escrow officer", phone: "414-555-0111", email: "pat@acme.example" },
    ]);

    await admin.mutation(api.titleCompanies.upsertContact, {
      titleCompanyId: id,
      contactId,
      name: "Pat Closer",
      role: "Closer",
    });
    const contacts = (await admin.query(api.titleCompanies.get, { id }))!.contacts;
    expect(contacts.find((contact) => contact._id === contactId)).toEqual({
      _id: contactId,
      name: "Pat Closer",
      role: "Closer",
      phone: undefined,
      email: undefined,
    });

    await admin.mutation(api.titleCompanies.removeContact, { titleCompanyId: id, contactId });
    expect((await admin.query(api.titleCompanies.get, { id }))?.contacts.map((c) => c.name)).toEqual([
      "Alex Admin",
    ]);
    expect(
      await userMessage(admin.mutation(api.titleCompanies.removeContact, { titleCompanyId: id, contactId }))
    ).toBe("This contact no longer exists.");

    for (let index = 1; index < MAX_TITLE_COMPANY_CONTACTS; index++) {
      await admin.mutation(api.titleCompanies.upsertContact, { titleCompanyId: id, name: `Contact ${index}` });
    }
    expect((await admin.query(api.titleCompanies.list, {}))[0].contactCount).toBe(MAX_TITLE_COMPANY_CONTACTS);
    expect(
      await userMessage(admin.mutation(api.titleCompanies.upsertContact, { titleCompanyId: id, name: "One too many" }))
    ).toBe(`A title company can have up to ${MAX_TITLE_COMPANY_CONTACTS} contacts.`);

    const actions = (await activity(t, id)).map((entry) => entry.action);
    expect(actions.slice(0, 5)).toEqual([
      "title_company.create",
      "title_company.contact.create",
      "title_company.contact.create",
      "title_company.contact.update",
      "title_company.contact.remove",
    ]);
  });

  test("contacts cannot be moved between companies", async () => {
    const { admin } = await fixture();
    const acmeId = await admin.mutation(api.titleCompanies.create, { name: "Acme Title" });
    const otherId = await admin.mutation(api.titleCompanies.create, { name: "Other Title" });
    const contactId = await admin.mutation(api.titleCompanies.upsertContact, { titleCompanyId: acmeId, name: "Pat" });

    expect(
      await userMessage(
        admin.mutation(api.titleCompanies.upsertContact, { titleCompanyId: otherId, contactId, name: "Pat" })
      )
    ).toBe("This contact no longer exists.");
    expect(
      await userMessage(admin.mutation(api.titleCompanies.removeContact, { titleCompanyId: otherId, contactId }))
    ).toBe("This contact no longer exists.");
  });

  test("removing a company deletes its contacts", async () => {
    const { t, admin } = await fixture();
    const id = await admin.mutation(api.titleCompanies.create, { name: "Acme Title" });
    const keepId = await admin.mutation(api.titleCompanies.create, { name: "Keep Title" });
    for (const name of ["Pat", "Sam", "Lee"]) {
      await admin.mutation(api.titleCompanies.upsertContact, { titleCompanyId: id, name });
    }
    await admin.mutation(api.titleCompanies.upsertContact, { titleCompanyId: keepId, name: "Kim" });
    await admin.action(api.titleCompanyActions.saveWireInstructions, {
      titleCompanyId: id,
      bankName: "First Bank",
      accountName: "Acme Title Escrow",
      routingNumber: ROUTING,
      accountNumber: ACCOUNT,
    });

    await admin.mutation(api.titleCompanies.remove, { id });

    expect(await admin.query(api.titleCompanies.get, { id })).toBeNull();
    const remaining = await t.run((ctx) => ctx.db.query("titleCompanyContacts").take(10));
    expect(remaining.map((contact) => contact.name)).toEqual(["Kim"]);
    expect((await activity(t, id)).at(-1)).toEqual({
      action: "title_company.delete",
      details: 'Deleted title company "Acme Title" with 3 contacts and wire instructions',
      userName: "Admin User",
    });
    expect(await userMessage(admin.mutation(api.titleCompanies.remove, { id }))).toBe(
      "This title company no longer exists."
    );
  });

  test("wire instructions are encrypted, summarized by last four, and revealed with an audit entry", async () => {
    const { t, admin, adminId } = await fixture();
    const id = await admin.mutation(api.titleCompanies.create, { name: "Acme Title" });

    expect(
      await userMessage(
        admin.action(api.titleCompanyActions.saveWireInstructions, {
          titleCompanyId: id,
          bankName: "First Bank",
          accountName: "Acme Title Escrow",
        })
      )
    ).toBe("Routing and account numbers are required.");
    expect(
      await userMessage(
        admin.action(api.titleCompanyActions.saveWireInstructions, {
          titleCompanyId: id,
          bankName: "First Bank",
          accountName: "Acme Title Escrow",
          routingNumber: ROUTING,
        })
      )
    ).toBe("Routing and account numbers are required.");
    expect(
      await userMessage(
        admin.action(api.titleCompanyActions.saveWireInstructions, {
          titleCompanyId: id,
          bankName: "First Bank",
          accountName: "Acme Title Escrow",
          routingNumber: "123456789",
          accountNumber: ACCOUNT,
        })
      )
    ).toBe("Enter a valid routing number.");
    expect((await admin.query(api.titleCompanies.get, { id }))?.wireInstructions).toBeNull();

    await admin.action(api.titleCompanyActions.saveWireInstructions, {
      titleCompanyId: id,
      bankName: " First Bank ",
      accountName: "Acme Title Escrow",
      routingNumber: "0210-00021",
      accountNumber: ` ${ACCOUNT} `,
      notes: "For further credit to file 2026-118",
    });

    const company = await admin.query(api.titleCompanies.get, { id });
    expect(company?.wireInstructions).toEqual({
      bankName: "First Bank",
      accountName: "Acme Title Escrow",
      routingLast4: "0021",
      accountLast4: "9012",
      notes: "For further credit to file 2026-118",
      updatedAt: expect.any(Number),
      updatedByName: "Admin User",
    });
    expect(JSON.stringify(company)).not.toContain(ROUTING);
    expect(JSON.stringify(company)).not.toContain(ACCOUNT);
    expect(JSON.stringify(company)).not.toContain("encrypted");
    expect((await admin.query(api.titleCompanies.list, {}))[0].hasWireInstructions).toBe(true);

    const stored = await t.run((ctx) => ctx.db.get("titleCompanies", id));
    expect(stored?.wireInstructions).toMatchObject({ keyVersion: 1, updatedBy: adminId });
    expect(stored?.wireInstructions?.encryptedRoutingNumber).not.toContain(ROUTING);
    expect(stored?.wireInstructions?.encryptedAccountNumber).not.toContain(ACCOUNT);

    const routing = await admin.action(api.titleCompanyActions.revealWireValue, {
      titleCompanyId: id,
      field: "routing_number",
    });
    const account = await admin.action(api.titleCompanyActions.revealWireValue, {
      titleCompanyId: id,
      field: "account_number",
    });
    expect(routing.value).toBe(ROUTING);
    expect(account.value).toBe(ACCOUNT);
    expect(account.expiresAt).toBeGreaterThan(Date.now());
    expect(account.expiresAt).toBeLessThanOrEqual(Date.now() + 30_000);

    expect((await activity(t, id)).slice(1)).toEqual([
      {
        action: "title_company.wire.create",
        details: 'Added wire instructions for title company "Acme Title" (First Bank, account ending 9012)',
        userName: "Admin User",
      },
      {
        action: "title_company.wire.reveal",
        details: 'Revealed wire routing number for title company "Acme Title"',
        userName: "Admin User",
      },
      {
        action: "title_company.wire.reveal",
        details: 'Revealed wire account number for title company "Acme Title"',
        userName: "Admin User",
      },
    ]);
  });

  test("editing wire instructions without numbers keeps the saved numbers", async () => {
    const { t, admin } = await fixture();
    const id = await admin.mutation(api.titleCompanies.create, { name: "Acme Title" });
    await admin.action(api.titleCompanyActions.saveWireInstructions, {
      titleCompanyId: id,
      bankName: "First Bank",
      accountName: "Acme Title Escrow",
      routingNumber: ROUTING,
      accountNumber: ACCOUNT,
      notes: "Reference the file number",
    });

    await admin.action(api.titleCompanyActions.saveWireInstructions, {
      titleCompanyId: id,
      bankName: "First Bank of Wisconsin",
      accountName: "Acme Title Escrow",
      routingNumber: " ",
      accountNumber: "",
    });
    expect((await admin.query(api.titleCompanies.get, { id }))?.wireInstructions).toEqual({
      bankName: "First Bank of Wisconsin",
      accountName: "Acme Title Escrow",
      routingLast4: "0021",
      accountLast4: "9012",
      notes: undefined,
      updatedAt: expect.any(Number),
      updatedByName: "Admin User",
    });
    expect(
      (await admin.action(api.titleCompanyActions.revealWireValue, { titleCompanyId: id, field: "account_number" }))
        .value
    ).toBe(ACCOUNT);

    expect(
      await userMessage(
        admin.action(api.titleCompanyActions.saveWireInstructions, {
          titleCompanyId: id,
          bankName: "First Bank",
          accountName: "Acme Title Escrow",
          accountNumber: NEW_ACCOUNT,
        })
      )
    ).toBe("Enter both routing and account numbers to replace the saved numbers, or leave both blank to keep them.");

    await admin.action(api.titleCompanyActions.saveWireInstructions, {
      titleCompanyId: id,
      bankName: "Second Bank",
      accountName: "Acme Title Escrow",
      routingNumber: NEW_ROUTING,
      accountNumber: NEW_ACCOUNT,
    });
    expect((await admin.query(api.titleCompanies.get, { id }))?.wireInstructions).toMatchObject({
      bankName: "Second Bank",
      routingLast4: "0015",
      accountLast4: "7766",
    });
    expect(
      (await admin.action(api.titleCompanyActions.revealWireValue, { titleCompanyId: id, field: "routing_number" }))
        .value
    ).toBe(NEW_ROUTING);

    const entries = (await activity(t, id)).filter((entry) => entry.action === "title_company.wire.update");
    expect(entries.map((entry) => entry.details)).toEqual([
      'Updated wire instructions for title company "Acme Title"\nKept the saved routing and account numbers\nChanged: Bank name, Notes',
      'Updated wire instructions for title company "Acme Title"\nReplaced routing and account numbers (account ending 9012 → 7766)\nChanged: Bank name',
    ]);
  });

  test("removing wire instructions clears them and blocks reveals", async () => {
    const { t, admin } = await fixture();
    const id = await admin.mutation(api.titleCompanies.create, { name: "Acme Title" });
    await admin.action(api.titleCompanyActions.saveWireInstructions, {
      titleCompanyId: id,
      bankName: "First Bank",
      accountName: "Acme Title Escrow",
      routingNumber: ROUTING,
      accountNumber: ACCOUNT,
    });

    await admin.mutation(api.titleCompanies.removeWireInstructions, { titleCompanyId: id });

    expect((await admin.query(api.titleCompanies.get, { id }))?.wireInstructions).toBeNull();
    expect(
      await userMessage(
        admin.action(api.titleCompanyActions.revealWireValue, { titleCompanyId: id, field: "routing_number" })
      )
    ).toBe("This title company has no wire instructions on file.");
    expect(
      await userMessage(
        admin.action(api.titleCompanyActions.saveWireInstructions, {
          titleCompanyId: id,
          bankName: "First Bank",
          accountName: "Acme Title Escrow",
        })
      )
    ).toBe("Routing and account numbers are required.");
    expect((await activity(t, id)).at(-1)).toEqual({
      action: "title_company.wire.remove",
      details: 'Removed wire instructions for title company "Acme Title" (First Bank, account ending 9012)',
      userName: "Admin User",
    });
  });
});
