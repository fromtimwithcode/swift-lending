import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  decryptSensitiveValue,
  encryptSensitiveValue,
  SENSITIVE_DATA_KEY_VERSION,
} from "./lib/sensitiveData";
import {
  normalizeAccountNumber,
  normalizeRoutingNumber,
  requiredText,
} from "./lib/borrowerPrivateValidation";
import {
  TITLE_COMPANY_LIMITS as LIMITS,
  wireFieldValidator,
  type WireField,
} from "./lib/titleCompanies";

function wireEncryptionContext(titleCompanyId: Id<"titleCompanies">, field: WireField) {
  return `titleCompany:${titleCompanyId}:${field}`;
}

function publicError(message: string) {
  return new ConvexError({ publicMessage: message });
}

export const saveWireInstructions = action({
  args: {
    titleCompanyId: v.id("titleCompanies"),
    bankName: v.string(),
    accountName: v.string(),
    routingNumber: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const prepared: { hasWireInstructions: boolean } = await ctx.runQuery(
      internal.titleCompanies.prepareWireInstructionsWrite,
      { titleCompanyId: args.titleCompanyId }
    );
    const bankName = requiredText(args.bankName, "Bank name", LIMITS.bankName);
    const accountName = requiredText(args.accountName, "Account name", LIMITS.accountName);
    const routingNumber = args.routingNumber?.trim()
      ? normalizeRoutingNumber(args.routingNumber)
      : undefined;
    const accountNumber = args.accountNumber?.trim()
      ? normalizeAccountNumber(args.accountNumber)
      : undefined;
    if (!prepared.hasWireInstructions && (!routingNumber || !accountNumber)) {
      throw publicError("Routing and account numbers are required.");
    }
    if (Boolean(routingNumber) !== Boolean(accountNumber)) {
      throw publicError(
        "Enter both routing and account numbers to replace the saved numbers, or leave both blank to keep them."
      );
    }

    const [encryptedRoutingNumber, encryptedAccountNumber] =
      routingNumber && accountNumber
        ? await Promise.all([
            encryptSensitiveValue(
              routingNumber,
              wireEncryptionContext(args.titleCompanyId, "routing_number")
            ),
            encryptSensitiveValue(
              accountNumber,
              wireEncryptionContext(args.titleCompanyId, "account_number")
            ),
          ])
        : [undefined, undefined];

    const result: null = await ctx.runMutation(
      internal.titleCompanies.persistWireInstructions,
      {
        titleCompanyId: args.titleCompanyId,
        bankName,
        accountName,
        notes: args.notes,
        encryptedRoutingNumber,
        routingLast4: routingNumber?.slice(-4),
        encryptedAccountNumber,
        accountLast4: accountNumber?.slice(-4),
        keyVersion: SENSITIVE_DATA_KEY_VERSION,
      }
    );
    return result;
  },
});

export const revealWireValue = action({
  args: { titleCompanyId: v.id("titleCompanies"), field: wireFieldValidator },
  handler: async (ctx, args) => {
    const payload: { encryptedValue: string; keyVersion: number } = await ctx.runQuery(
      internal.titleCompanies.getEncryptedWireValueForReveal,
      args
    );
    const value = await decryptSensitiveValue(
      payload.encryptedValue,
      wireEncryptionContext(args.titleCompanyId, args.field),
      payload.keyVersion
    );
    await ctx.runMutation(internal.titleCompanies.logWireReveal, args);
    return { value, expiresAt: Date.now() + 30_000 };
  },
});
