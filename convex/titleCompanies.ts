import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth";
import {
  optionalEmail,
  optionalText,
  requiredText,
} from "./lib/borrowerPrivateValidation";
import {
  collapseWhitespace,
  MAX_TITLE_COMPANIES,
  MAX_TITLE_COMPANY_CONTACTS,
  normalizeTitleCompanyName,
  TITLE_COMPANY_LIMITS as LIMITS,
  wireFieldValidator,
  type WireField,
} from "./lib/titleCompanies";

const companyFields = {
  name: v.string(),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  address: v.optional(v.string()),
  notes: v.optional(v.string()),
};

const COMPANY_FIELD_LABELS = {
  name: "Name",
  phone: "Phone",
  email: "Email",
  address: "Address",
  notes: "Notes",
} as const;

const WIRE_FIELD_LABELS: Record<WireField, string> = {
  routing_number: "routing number",
  account_number: "account number",
};

function publicError(message: string) {
  return new ConvexError({ publicMessage: message });
}

async function requireTitleCompany(
  ctx: QueryCtx | MutationCtx,
  id: Id<"titleCompanies">
) {
  const company = await ctx.db.get("titleCompanies", id);
  if (!company) throw publicError("This title company no longer exists.");
  return company;
}

function parseCompanyFields(args: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}) {
  const name = collapseWhitespace(requiredText(args.name, "Name", LIMITS.name));
  return {
    name,
    normalizedName: normalizeTitleCompanyName(name),
    phone: optionalText(args.phone, "Phone", LIMITS.phone),
    email: optionalEmail(args.email),
    address: optionalText(args.address, "Address", LIMITS.address),
    notes: optionalText(args.notes, "Notes", LIMITS.notes),
  };
}

async function assertNameAvailable(
  ctx: MutationCtx,
  fields: { name: string; normalizedName: string },
  excludeId?: Id<"titleCompanies">
) {
  const matches = await ctx.db
    .query("titleCompanies")
    .withIndex("by_normalizedName", (q) => q.eq("normalizedName", fields.normalizedName))
    .take(2);
  if (matches.some((match) => match._id !== excludeId)) {
    throw publicError(`A title company named "${fields.name}" already exists.`);
  }
}

function listContacts(ctx: QueryCtx | MutationCtx, titleCompanyId: Id<"titleCompanies">) {
  return ctx.db
    .query("titleCompanyContacts")
    .withIndex("by_titleCompanyId", (q) => q.eq("titleCompanyId", titleCompanyId))
    .take(MAX_TITLE_COMPANY_CONTACTS);
}

async function logActivity(
  ctx: MutationCtx,
  admin: Doc<"userProfiles">,
  action: string,
  titleCompanyId: Id<"titleCompanies">,
  details: string
) {
  await ctx.db.insert("activityLog", {
    userId: admin._id,
    userName: admin.displayName,
    action,
    entityType: "title_company",
    entityId: titleCompanyId,
    details,
  });
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const companies = await ctx.db
      .query("titleCompanies")
      .withIndex("by_normalizedName")
      .take(MAX_TITLE_COMPANIES);
    return await Promise.all(
      companies.map(async (company) => ({
        _id: company._id,
        name: company.name,
        phone: company.phone,
        email: company.email,
        contactCount: (await listContacts(ctx, company._id)).length,
        hasWireInstructions: company.wireInstructions !== undefined,
      }))
    );
  },
});

export const get = query({
  args: { id: v.id("titleCompanies") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const company = await ctx.db.get("titleCompanies", args.id);
    if (!company) return null;

    const contacts = (await listContacts(ctx, company._id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((contact) => ({
        _id: contact._id,
        name: contact.name,
        role: contact.role,
        phone: contact.phone,
        email: contact.email,
      }));

    const wire = company.wireInstructions;
    const wireUpdatedBy = wire ? await ctx.db.get("userProfiles", wire.updatedBy) : null;

    return {
      _id: company._id,
      name: company.name,
      phone: company.phone,
      email: company.email,
      address: company.address,
      notes: company.notes,
      updatedAt: company.updatedAt,
      contacts,
      wireInstructions: wire
        ? {
            bankName: wire.bankName,
            accountName: wire.accountName,
            routingLast4: wire.routingLast4,
            accountLast4: wire.accountLast4,
            notes: wire.notes,
            updatedAt: wire.updatedAt,
            updatedByName: wireUpdatedBy?.displayName ?? "Unknown user",
          }
        : null,
    };
  },
});

export const create = mutation({
  args: companyFields,
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const fields = parseCompanyFields(args);
    await assertNameAvailable(ctx, fields);
    const existing = await ctx.db.query("titleCompanies").take(MAX_TITLE_COMPANIES);
    if (existing.length >= MAX_TITLE_COMPANIES) {
      throw publicError(
        `You can keep up to ${MAX_TITLE_COMPANIES} title companies. Delete one you no longer use first.`
      );
    }

    const id = await ctx.db.insert("titleCompanies", {
      ...fields,
      updatedAt: Date.now(),
      updatedBy: admin._id,
    });
    await logActivity(ctx, admin, "title_company.create", id, `Added title company "${fields.name}"`);
    return id;
  },
});

export const update = mutation({
  args: { id: v.id("titleCompanies"), ...companyFields },
  handler: async (ctx, { id, ...args }) => {
    const admin = await requireAdmin(ctx);
    const company = await requireTitleCompany(ctx, id);
    const fields = parseCompanyFields(args);
    if (fields.normalizedName !== company.normalizedName) {
      await assertNameAvailable(ctx, fields, id);
    }

    const changed = (Object.keys(COMPANY_FIELD_LABELS) as (keyof typeof COMPANY_FIELD_LABELS)[])
      .filter((key) => company[key] !== fields[key]);
    if (changed.length === 0) return id;

    await ctx.db.patch("titleCompanies", id, {
      ...fields,
      updatedAt: Date.now(),
      updatedBy: admin._id,
    });
    const renamed = fields.name !== company.name ? ` (formerly "${company.name}")` : "";
    await logActivity(
      ctx,
      admin,
      "title_company.update",
      id,
      `Updated title company "${fields.name}"${renamed}\nChanged: ${changed
        .map((key) => COMPANY_FIELD_LABELS[key])
        .join(", ")}`
    );
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("titleCompanies") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const company = await requireTitleCompany(ctx, args.id);

    let removedContacts = 0;
    for (;;) {
      const batch = await listContacts(ctx, company._id);
      if (batch.length === 0) break;
      for (const contact of batch) {
        await ctx.db.delete("titleCompanyContacts", contact._id);
      }
      removedContacts += batch.length;
    }
    await ctx.db.delete("titleCompanies", company._id);

    const removed = [
      `${removedContacts} contact${removedContacts === 1 ? "" : "s"}`,
      ...(company.wireInstructions ? ["wire instructions"] : []),
    ];
    await logActivity(
      ctx,
      admin,
      "title_company.delete",
      company._id,
      `Deleted title company "${company.name}" with ${removed.join(" and ")}`
    );
    return null;
  },
});

export const upsertContact = mutation({
  args: {
    titleCompanyId: v.id("titleCompanies"),
    contactId: v.optional(v.id("titleCompanyContacts")),
    name: v.string(),
    role: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const company = await requireTitleCompany(ctx, args.titleCompanyId);
    const existing = args.contactId
      ? await ctx.db.get("titleCompanyContacts", args.contactId)
      : null;
    if (args.contactId && (!existing || existing.titleCompanyId !== company._id)) {
      throw publicError("This contact no longer exists.");
    }
    if (!existing) {
      const contacts = await listContacts(ctx, company._id);
      if (contacts.length >= MAX_TITLE_COMPANY_CONTACTS) {
        throw publicError(
          `A title company can have up to ${MAX_TITLE_COMPANY_CONTACTS} contacts.`
        );
      }
    }

    const values = {
      name: requiredText(args.name, "Name", LIMITS.name),
      role: optionalText(args.role, "Role", LIMITS.contactRole),
      phone: optionalText(args.phone, "Phone", LIMITS.phone),
      email: optionalEmail(args.email),
      updatedAt: Date.now(),
      updatedBy: admin._id,
    };

    let contactId: Id<"titleCompanyContacts">;
    if (existing) {
      contactId = existing._id;
      await ctx.db.patch("titleCompanyContacts", contactId, values);
    } else {
      contactId = await ctx.db.insert("titleCompanyContacts", {
        titleCompanyId: company._id,
        ...values,
      });
    }

    await logActivity(
      ctx,
      admin,
      existing ? "title_company.contact.update" : "title_company.contact.create",
      company._id,
      existing
        ? `Updated contact "${values.name}" for title company "${company.name}"`
        : `Added contact "${values.name}" to title company "${company.name}"`
    );
    return contactId;
  },
});

export const removeContact = mutation({
  args: {
    titleCompanyId: v.id("titleCompanies"),
    contactId: v.id("titleCompanyContacts"),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const company = await requireTitleCompany(ctx, args.titleCompanyId);
    const contact = await ctx.db.get("titleCompanyContacts", args.contactId);
    if (!contact || contact.titleCompanyId !== company._id) {
      throw publicError("This contact no longer exists.");
    }
    await ctx.db.delete("titleCompanyContacts", contact._id);
    await logActivity(
      ctx,
      admin,
      "title_company.contact.remove",
      company._id,
      `Removed contact "${contact.name}" from title company "${company.name}"`
    );
    return null;
  },
});

export const removeWireInstructions = mutation({
  args: { titleCompanyId: v.id("titleCompanies") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const company = await requireTitleCompany(ctx, args.titleCompanyId);
    const wire = company.wireInstructions;
    if (!wire) return null;

    await ctx.db.patch("titleCompanies", company._id, { wireInstructions: undefined });
    await logActivity(
      ctx,
      admin,
      "title_company.wire.remove",
      company._id,
      `Removed wire instructions for title company "${company.name}" (${wire.bankName}, account ending ${wire.accountLast4})`
    );
    return null;
  },
});

export const prepareWireInstructionsWrite = internalQuery({
  args: { titleCompanyId: v.id("titleCompanies") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const company = await requireTitleCompany(ctx, args.titleCompanyId);
    return { hasWireInstructions: company.wireInstructions !== undefined };
  },
});

export const persistWireInstructions = internalMutation({
  args: {
    titleCompanyId: v.id("titleCompanies"),
    bankName: v.string(),
    accountName: v.string(),
    notes: v.optional(v.string()),
    encryptedRoutingNumber: v.optional(v.string()),
    routingLast4: v.optional(v.string()),
    encryptedAccountNumber: v.optional(v.string()),
    accountLast4: v.optional(v.string()),
    keyVersion: v.number(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const company = await requireTitleCompany(ctx, args.titleCompanyId);
    const existing = company.wireInstructions;

    const numberFields = [
      args.encryptedRoutingNumber,
      args.routingLast4,
      args.encryptedAccountNumber,
      args.accountLast4,
    ];
    const hasNumbers = numberFields.some((value) => value !== undefined);
    if (
      (hasNumbers && numberFields.some((value) => !value)) ||
      (args.routingLast4 !== undefined && !/^\d{4}$/.test(args.routingLast4)) ||
      (args.accountLast4 !== undefined && !/^\d{4}$/.test(args.accountLast4)) ||
      args.keyVersion < 1
    ) {
      throw new ConvexError("Invalid encrypted wire instructions payload");
    }
    const numbers = hasNumbers
      ? {
          encryptedRoutingNumber: args.encryptedRoutingNumber!,
          routingLast4: args.routingLast4!,
          encryptedAccountNumber: args.encryptedAccountNumber!,
          accountLast4: args.accountLast4!,
          keyVersion: args.keyVersion,
        }
      : existing && {
          encryptedRoutingNumber: existing.encryptedRoutingNumber,
          routingLast4: existing.routingLast4,
          encryptedAccountNumber: existing.encryptedAccountNumber,
          accountLast4: existing.accountLast4,
          keyVersion: existing.keyVersion,
        };
    if (!numbers) throw publicError("Routing and account numbers are required.");

    const bankName = requiredText(args.bankName, "Bank name", LIMITS.bankName);
    const accountName = requiredText(args.accountName, "Account name", LIMITS.accountName);
    const notes = optionalText(args.notes, "Wire notes", LIMITS.notes);

    await ctx.db.patch("titleCompanies", company._id, {
      wireInstructions: {
        bankName,
        accountName,
        ...numbers,
        ...(notes !== undefined && { notes }),
        updatedAt: Date.now(),
        updatedBy: admin._id,
      },
    });

    let details: string;
    if (!existing) {
      details = `Added wire instructions for title company "${company.name}" (${bankName}, account ending ${numbers.accountLast4})`;
    } else {
      const changes = [
        ...(existing.bankName !== bankName ? ["Bank name"] : []),
        ...(existing.accountName !== accountName ? ["Account name"] : []),
        ...(existing.notes !== notes ? ["Notes"] : []),
      ];
      details = [
        `Updated wire instructions for title company "${company.name}"`,
        hasNumbers
          ? `Replaced routing and account numbers (account ending ${existing.accountLast4} → ${numbers.accountLast4})`
          : "Kept the saved routing and account numbers",
        ...(changes.length > 0 ? [`Changed: ${changes.join(", ")}`] : []),
      ].join("\n");
    }
    await logActivity(
      ctx,
      admin,
      existing ? "title_company.wire.update" : "title_company.wire.create",
      company._id,
      details
    );
    return null;
  },
});

export const getEncryptedWireValueForReveal = internalQuery({
  args: { titleCompanyId: v.id("titleCompanies"), field: wireFieldValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const company = await requireTitleCompany(ctx, args.titleCompanyId);
    const wire = company.wireInstructions;
    if (!wire) throw publicError("This title company has no wire instructions on file.");
    return {
      encryptedValue:
        args.field === "routing_number"
          ? wire.encryptedRoutingNumber
          : wire.encryptedAccountNumber,
      keyVersion: wire.keyVersion,
    };
  },
});

export const logWireReveal = internalMutation({
  args: { titleCompanyId: v.id("titleCompanies"), field: wireFieldValidator },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const company = await requireTitleCompany(ctx, args.titleCompanyId);
    await logActivity(
      ctx,
      admin,
      "title_company.wire.reveal",
      company._id,
      `Revealed wire ${WIRE_FIELD_LABELS[args.field]} for title company "${company.name}"`
    );
    return null;
  },
});
