import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  decryptSensitiveValue,
  encryptSensitiveValue,
  SENSITIVE_DATA_KEY_VERSION,
} from "./lib/sensitiveData";
import {
  accountTypeValidator,
  normalizeAccountNumber,
  normalizeEin,
  normalizeRoutingNumber,
  requiredText,
} from "./lib/borrowerPrivateValidation";
import type { Id } from "./_generated/dataModel";

const sensitiveFieldValidator = v.union(
  v.literal("ein"),
  v.literal("routing_number"),
  v.literal("account_number")
);

type RevealPayload = {
  encryptedValue: string;
  adminId: Id<"userProfiles">;
  adminName: string;
  borrowerName: string;
  fieldLabel: string;
  encryptionContext: string | null;
  keyVersion: number;
};

export const saveEin = action({
  args: { borrowerId: v.id("userProfiles"), ein: v.string() },
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.borrowerPrivate.prepareEinWrite, {
      borrowerId: args.borrowerId,
    });
    const ein = normalizeEin(args.ein);
    const encryptedEin = await encryptSensitiveValue(
      ein,
      `${args.borrowerId}:ein`
    );
    const result: null = await ctx.runMutation(
      internal.borrowerPrivate.persistEin,
      {
        borrowerId: args.borrowerId,
        encryptedEin,
        einLast4: ein.slice(-4),
        keyVersion: SENSITIVE_DATA_KEY_VERSION,
      }
    );
    return result;
  },
});

export const upsertBankAccount = action({
  args: {
    borrowerId: v.id("userProfiles"),
    accountId: v.optional(v.id("borrowerBankAccounts")),
    bankName: v.string(),
    accountHolderName: v.string(),
    accountType: accountTypeValidator,
    routingNumber: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    isPrimary: v.boolean(),
  },
  handler: async (ctx, args) => {
    const prepared: { exists: boolean; encryptionContext: string | null } = await ctx.runQuery(
      internal.borrowerPrivate.prepareBankAccountWrite,
      { borrowerId: args.borrowerId, accountId: args.accountId }
    );
    const bankName = requiredText(args.bankName, "Bank name");
    const accountHolderName = requiredText(
      args.accountHolderName,
      "Account holder name"
    );
    const routingNumber = args.routingNumber
      ? normalizeRoutingNumber(args.routingNumber)
      : undefined;
    const accountNumber = args.accountNumber
      ? normalizeAccountNumber(args.accountNumber)
      : undefined;
    if (!prepared.exists && (!routingNumber || !accountNumber)) {
      throw new ConvexError("Routing and account numbers are required");
    }
    if (prepared.exists && Boolean(routingNumber) !== Boolean(accountNumber)) {
      throw new ConvexError(
        "Enter both routing and account numbers to replace bank details"
      );
    }
    const encryptionContext = prepared.encryptionContext ?? crypto.randomUUID();

    const [encryptedRoutingNumber, encryptedAccountNumber] = await Promise.all([
      routingNumber
        ? encryptSensitiveValue(
            routingNumber,
            `${args.borrowerId}:${encryptionContext}:routing_number`
          )
        : undefined,
      accountNumber
        ? encryptSensitiveValue(
            accountNumber,
            `${args.borrowerId}:${encryptionContext}:account_number`
          )
        : undefined,
    ]);
    const accountId: Id<"borrowerBankAccounts"> = await ctx.runMutation(
      internal.borrowerPrivate.persistBankAccount,
      {
        borrowerId: args.borrowerId,
        accountId: args.accountId,
        bankName,
        accountHolderName,
        accountType: args.accountType,
        encryptedRoutingNumber,
        routingLast4: routingNumber?.slice(-4),
        encryptedAccountNumber,
        accountLast4: accountNumber?.slice(-4),
        encryptionContext,
        keyVersion: SENSITIVE_DATA_KEY_VERSION,
        isPrimary: args.isPrimary,
      }
    );
    return accountId;
  },
});

export const revealSensitiveValue = action({
  args: {
    borrowerId: v.id("userProfiles"),
    field: sensitiveFieldValidator,
    accountId: v.optional(v.id("borrowerBankAccounts")),
  },
  handler: async (ctx, args) => {
    const payload: RevealPayload = await ctx.runQuery(
      internal.borrowerPrivate.getEncryptedValueForReveal,
      args
    );
    if (args.field !== "ein" && !payload.encryptionContext) {
      throw new ConvexError({
        publicMessage:
          "Secure borrower data could not be read. Try again or contact the developer.",
      });
    }
    const context =
      args.field === "ein"
        ? `${args.borrowerId}:ein`
        : `${args.borrowerId}:${payload.encryptionContext}:${args.field}`;
    const value = await decryptSensitiveValue(
      payload.encryptedValue,
      context,
      payload.keyVersion
    );
    await ctx.runMutation(internal.borrowerPrivate.logSensitiveReveal, {
      adminId: payload.adminId,
      adminName: payload.adminName,
      borrowerId: args.borrowerId,
      borrowerName: payload.borrowerName,
      fieldLabel: payload.fieldLabel,
    });

    return { value, expiresAt: Date.now() + 30_000 };
  },
});
