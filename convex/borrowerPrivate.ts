import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { requireAdmin } from "./lib/auth";
import {
  accountTypeValidator,
  requiredText,
} from "./lib/borrowerPrivateValidation";

const MAX_BANK_ACCOUNTS = 10;
const MAX_RELATED_PARTIES = 50;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const partyTypeValidator = v.union(
  v.literal("co_borrower"),
  v.literal("guarantor"),
  v.literal("member"),
  v.literal("spouse"),
  v.literal("other")
);
const sensitiveFieldValidator = v.union(
  v.literal("ein"),
  v.literal("routing_number"),
  v.literal("account_number")
);

function optionalText(value: string | undefined, label: string, maxLength = 240) {
  const normalized = value?.trim() || undefined;
  if (normalized && normalized.length > maxLength) {
    throw new ConvexError(`${label} must be ${maxLength} characters or fewer`);
  }
  return normalized;
}

async function requireBorrower(
  ctx: QueryCtx | MutationCtx,
  borrowerId: Id<"userProfiles">
) {
  const borrower = await ctx.db.get(borrowerId);
  if (!borrower || !("role" in borrower) || borrower.role !== "borrower") {
    throw new ConvexError("Borrower not found");
  }
  return borrower;
}

export const getFinancialSummary = query({
  args: { borrowerId: v.id("userProfiles") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await requireBorrower(ctx, args.borrowerId);

    const details = await ctx.db
      .query("borrowerSensitiveDetails")
      .withIndex("by_borrowerId", (q) => q.eq("borrowerId", args.borrowerId))
      .unique();
    const accounts = await ctx.db
      .query("borrowerBankAccounts")
      .withIndex("by_borrowerId", (q) => q.eq("borrowerId", args.borrowerId))
      .order("desc")
      .take(MAX_BANK_ACCOUNTS);

    return {
      ein: details
        ? { last4: details.einLast4, updatedAt: details.updatedAt }
        : null,
      accounts: accounts.map((account) => ({
        _id: account._id,
        bankName: account.bankName,
        accountHolderName: account.accountHolderName,
        accountType: account.accountType,
        routingLast4: account.routingLast4,
        accountLast4: account.accountLast4,
        isPrimary: account.isPrimary,
      })),
    };
  },
});

export const listRelatedParties = query({
  args: { borrowerId: v.id("userProfiles") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await requireBorrower(ctx, args.borrowerId);
    const parties = await ctx.db
      .query("borrowerRelatedParties")
      .withIndex("by_borrowerId", (q) => q.eq("borrowerId", args.borrowerId))
      .order("desc")
      .take(MAX_RELATED_PARTIES);
    return parties.map((party) => ({
      _id: party._id,
      type: party.type,
      fullName: party.fullName,
      email: party.email,
      phone: party.phone,
      company: party.company,
      relationship: party.relationship,
      notes: party.notes,
    }));
  },
});

export const prepareEinWrite = internalQuery({
  args: { borrowerId: v.id("userProfiles") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await requireBorrower(ctx, args.borrowerId);
    return null;
  },
});

export const persistEin = internalMutation({
  args: {
    borrowerId: v.id("userProfiles"),
    encryptedEin: v.string(),
    einLast4: v.string(),
    keyVersion: v.number(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const borrower = await requireBorrower(ctx, args.borrowerId);
    if (!/^\d{4}$/.test(args.einLast4) || args.keyVersion < 1) {
      throw new ConvexError("Invalid encrypted EIN payload");
    }

    const existing = await ctx.db
      .query("borrowerSensitiveDetails")
      .withIndex("by_borrowerId", (q) => q.eq("borrowerId", args.borrowerId))
      .unique();
    const values = {
      encryptedEin: args.encryptedEin,
      einLast4: args.einLast4,
      keyVersion: args.keyVersion,
      updatedAt: Date.now(),
      updatedBy: admin._id,
    };

    if (existing) await ctx.db.patch(existing._id, values);
    else {
      await ctx.db.insert("borrowerSensitiveDetails", {
        borrowerId: args.borrowerId,
        ...values,
      });
    }

    await ctx.db.insert("activityLog", {
      userId: admin._id,
      userName: admin.displayName,
      action: "borrower.sensitiveDetails.updateEin",
      entityType: "user",
      entityId: args.borrowerId,
      details: `Updated EIN for borrower "${borrower.displayName}"`,
    });
    return null;
  },
});

export const prepareBankAccountWrite = internalQuery({
  args: {
    borrowerId: v.id("userProfiles"),
    accountId: v.optional(v.id("borrowerBankAccounts")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await requireBorrower(ctx, args.borrowerId);
    const existing = args.accountId ? await ctx.db.get(args.accountId) : null;
    if (args.accountId && (!existing || existing.borrowerId !== args.borrowerId)) {
      throw new ConvexError("Bank account not found");
    }
    if (!existing) {
      const accounts = await ctx.db
        .query("borrowerBankAccounts")
        .withIndex("by_borrowerId", (q) => q.eq("borrowerId", args.borrowerId))
        .take(MAX_BANK_ACCOUNTS);
      if (accounts.length >= MAX_BANK_ACCOUNTS) {
        throw new ConvexError(`A borrower can have up to ${MAX_BANK_ACCOUNTS} bank accounts`);
      }
    }
    return {
      exists: existing !== null,
      encryptionContext: existing?.encryptionContext ?? null,
    };
  },
});

export const persistBankAccount = internalMutation({
  args: {
    borrowerId: v.id("userProfiles"),
    accountId: v.optional(v.id("borrowerBankAccounts")),
    bankName: v.string(),
    accountHolderName: v.string(),
    accountType: accountTypeValidator,
    encryptedRoutingNumber: v.optional(v.string()),
    routingLast4: v.optional(v.string()),
    encryptedAccountNumber: v.optional(v.string()),
    accountLast4: v.optional(v.string()),
    encryptionContext: v.string(),
    keyVersion: v.number(),
    isPrimary: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const borrower = await requireBorrower(ctx, args.borrowerId);
    const existing = args.accountId ? await ctx.db.get(args.accountId) : null;
    if (args.accountId && (!existing || existing.borrowerId !== args.borrowerId)) {
      throw new ConvexError("Bank account not found");
    }
    if (!existing) {
      const accountCount = await ctx.db
        .query("borrowerBankAccounts")
        .withIndex("by_borrowerId", (q) => q.eq("borrowerId", args.borrowerId))
        .take(MAX_BANK_ACCOUNTS);
      if (accountCount.length >= MAX_BANK_ACCOUNTS) {
        throw new ConvexError(`A borrower can have up to ${MAX_BANK_ACCOUNTS} bank accounts`);
      }
    }

    const hasRoutingUpdate =
      args.encryptedRoutingNumber !== undefined || args.routingLast4 !== undefined;
    const hasAccountUpdate =
      args.encryptedAccountNumber !== undefined || args.accountLast4 !== undefined;
    if (
      hasRoutingUpdate !== hasAccountUpdate ||
      (hasRoutingUpdate &&
        (!args.encryptedRoutingNumber || !args.routingLast4 || !/^\d{4}$/.test(args.routingLast4))) ||
      (hasAccountUpdate &&
        (!args.encryptedAccountNumber || !args.accountLast4 || !/^\d{4}$/.test(args.accountLast4))) ||
      args.keyVersion < 1
    ) {
      throw new ConvexError("Invalid encrypted bank account payload");
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(args.encryptionContext)) {
      throw new ConvexError("Invalid bank account encryption context");
    }
    if (existing && existing.encryptionContext !== args.encryptionContext) {
      throw new ConvexError("Bank account encryption context cannot be changed");
    }
    if (!existing && (!hasRoutingUpdate || !hasAccountUpdate)) {
      throw new ConvexError("Routing and account numbers are required");
    }

    const bankName = requiredText(args.bankName, "Bank name");
    const accountHolderName = requiredText(args.accountHolderName, "Account holder name");

    if (args.isPrimary) {
      const accounts = await ctx.db
        .query("borrowerBankAccounts")
        .withIndex("by_borrowerId", (q) => q.eq("borrowerId", args.borrowerId))
        .take(MAX_BANK_ACCOUNTS);
      for (const account of accounts) {
        if (account._id !== args.accountId && account.isPrimary) {
          await ctx.db.patch(account._id, { isPrimary: false });
        }
      }
    }

    const updatedAt = Date.now();
    let accountId = args.accountId;
    if (existing && accountId) {
      const sensitiveUpdates = {
        ...(hasRoutingUpdate && {
          encryptedRoutingNumber: args.encryptedRoutingNumber,
          routingLast4: args.routingLast4,
        }),
        ...(hasAccountUpdate && {
          encryptedAccountNumber: args.encryptedAccountNumber,
          accountLast4: args.accountLast4,
        }),
        ...((hasRoutingUpdate || hasAccountUpdate) && { keyVersion: args.keyVersion }),
      };
      await ctx.db.patch(accountId, {
        bankName,
        accountHolderName,
        accountType: args.accountType,
        isPrimary: args.isPrimary,
        updatedAt,
        updatedBy: admin._id,
        ...sensitiveUpdates,
      });
    } else {
      accountId = await ctx.db.insert("borrowerBankAccounts", {
        borrowerId: args.borrowerId,
        bankName,
        accountHolderName,
        accountType: args.accountType,
        encryptedRoutingNumber: args.encryptedRoutingNumber!,
        routingLast4: args.routingLast4!,
        encryptedAccountNumber: args.encryptedAccountNumber!,
        accountLast4: args.accountLast4!,
        encryptionContext: args.encryptionContext,
        keyVersion: args.keyVersion,
        isPrimary: args.isPrimary,
        updatedAt,
        updatedBy: admin._id,
      });
    }

    await ctx.db.insert("activityLog", {
      userId: admin._id,
      userName: admin.displayName,
      action: existing ? "borrower.bankAccount.update" : "borrower.bankAccount.create",
      entityType: "user",
      entityId: args.borrowerId,
      details: `${existing ? "Updated" : "Added"} bank account for borrower "${borrower.displayName}"`,
    });
    return accountId;
  },
});

export const removeBankAccount = mutation({
  args: { borrowerId: v.id("userProfiles"), accountId: v.id("borrowerBankAccounts") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const borrower = await requireBorrower(ctx, args.borrowerId);
    const account = await ctx.db.get(args.accountId);
    if (!account || account.borrowerId !== args.borrowerId) throw new ConvexError("Bank account not found");

    await ctx.db.delete(account._id);
    if (account.isPrimary) {
      const replacement = await ctx.db
        .query("borrowerBankAccounts")
        .withIndex("by_borrowerId", (q) => q.eq("borrowerId", args.borrowerId))
        .order("desc")
        .take(1);
      if (replacement[0]) await ctx.db.patch(replacement[0]._id, { isPrimary: true });
    }

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "borrower.bankAccount.remove",
      entityType: "user",
      entityId: args.borrowerId,
      details: `Removed bank account for borrower "${borrower.displayName}"`,
    });
    return null;
  },
});

export const upsertRelatedParty = mutation({
  args: {
    borrowerId: v.id("userProfiles"),
    partyId: v.optional(v.id("borrowerRelatedParties")),
    type: partyTypeValidator,
    fullName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    company: v.optional(v.string()),
    relationship: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const borrower = await requireBorrower(ctx, args.borrowerId);
    const existing = args.partyId ? await ctx.db.get(args.partyId) : null;
    if (args.partyId && (!existing || existing.borrowerId !== args.borrowerId)) {
      throw new ConvexError("Related party not found");
    }
    if (!existing) {
      const partyCount = await ctx.db
        .query("borrowerRelatedParties")
        .withIndex("by_borrowerId", (q) => q.eq("borrowerId", args.borrowerId))
        .take(MAX_RELATED_PARTIES);
      if (partyCount.length >= MAX_RELATED_PARTIES) {
        throw new ConvexError(`A borrower can have up to ${MAX_RELATED_PARTIES} related parties`);
      }
    }

    const email = optionalText(args.email, "Email", 254)?.toLowerCase();
    if (email && !EMAIL_REGEX.test(email)) throw new ConvexError("Enter a valid email address");
    const values = {
      type: args.type,
      fullName: requiredText(args.fullName, "Full name"),
      email,
      phone: optionalText(args.phone, "Phone", 40),
      company: optionalText(args.company, "Company", 120),
      relationship: optionalText(args.relationship, "Relationship", 120),
      notes: optionalText(args.notes, "Notes", 1000),
      updatedAt: Date.now(),
      updatedBy: admin._id,
    };

    let partyId = args.partyId;
    if (existing && partyId) await ctx.db.patch(partyId, values);
    else partyId = await ctx.db.insert("borrowerRelatedParties", { borrowerId: args.borrowerId, ...values });

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: existing ? "borrower.relatedParty.update" : "borrower.relatedParty.create",
      entityType: "user",
      entityId: args.borrowerId,
      details: `${existing ? "Updated" : "Added"} related party for borrower "${borrower.displayName}"`,
    });
    return partyId;
  },
});

export const removeRelatedParty = mutation({
  args: { borrowerId: v.id("userProfiles"), partyId: v.id("borrowerRelatedParties") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const borrower = await requireBorrower(ctx, args.borrowerId);
    const party = await ctx.db.get(args.partyId);
    if (!party || party.borrowerId !== args.borrowerId) throw new ConvexError("Related party not found");
    await ctx.db.delete(party._id);
    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "borrower.relatedParty.remove",
      entityType: "user",
      entityId: args.borrowerId,
      details: `Removed related party from borrower "${borrower.displayName}"`,
    });
    return null;
  },
});

export const getEncryptedValueForReveal = internalQuery({
  args: {
    borrowerId: v.id("userProfiles"),
    field: sensitiveFieldValidator,
    accountId: v.optional(v.id("borrowerBankAccounts")),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const borrower = await requireBorrower(ctx, args.borrowerId);

    if (args.field === "ein") {
      const details = await ctx.db
        .query("borrowerSensitiveDetails")
        .withIndex("by_borrowerId", (q) => q.eq("borrowerId", args.borrowerId))
        .unique();
      if (!details) throw new ConvexError("EIN not found");
      return {
        encryptedValue: details.encryptedEin,
        encryptionContext: null,
        keyVersion: details.keyVersion,
        adminId: admin._id,
        adminName: admin.displayName,
        borrowerName: borrower.displayName,
        fieldLabel: "EIN",
      };
    }

    if (!args.accountId) throw new ConvexError("Bank account not found");
    const account = await ctx.db.get(args.accountId);
    if (!account || account.borrowerId !== args.borrowerId) throw new ConvexError("Bank account not found");
    return {
      encryptedValue:
        args.field === "routing_number"
          ? account.encryptedRoutingNumber
          : account.encryptedAccountNumber,
      encryptionContext: account.encryptionContext,
      keyVersion: account.keyVersion,
      adminId: admin._id,
      adminName: admin.displayName,
      borrowerName: borrower.displayName,
      fieldLabel: args.field === "routing_number" ? "routing number" : "account number",
    };
  },
});

export const logSensitiveReveal = internalMutation({
  args: {
    adminId: v.id("userProfiles"),
    adminName: v.string(),
    borrowerId: v.id("userProfiles"),
    borrowerName: v.string(),
    fieldLabel: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("activityLog", {
      userId: args.adminId,
      userName: args.adminName,
      action: "borrower.sensitiveDetails.reveal",
      entityType: "user",
      entityId: args.borrowerId,
      details: `Revealed ${args.fieldLabel} for borrower "${args.borrowerName}"`,
    });
    return null;
  },
});
