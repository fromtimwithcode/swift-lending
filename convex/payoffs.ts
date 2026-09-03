import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { requireAnyRole } from "./lib/auth";
import { getBusinessDate, parseUsDate } from "./lib/dates";
import { calculateDatedPayoff } from "./lib/payoffCalculations";
import {
  evaluatePayoffReadiness,
  getPayoffCalculationBlocked,
  MAX_PAYOFF_LEDGER_ITEMS,
} from "./lib/payoffReadiness";

async function getPayoffContext(ctx: QueryCtx, loanId: Id<"loans">) {
  const profile = await requireAnyRole(ctx, ["admin", "borrower"]);
  const loan = await ctx.db.get(loanId);
  if (!loan) throw new ConvexError("Loan not found");
  if (profile.role === "borrower" && loan.borrowerId !== profile._id) {
    throw new ConvexError("Not your loan");
  }

  const [draws, payments, charges] = await Promise.all([
    ctx.db
      .query("drawRequests")
      .withIndex("by_loanId", (q) => q.eq("loanId", loanId))
      .take(MAX_PAYOFF_LEDGER_ITEMS + 1),
    ctx.db
      .query("loanPayments")
      .withIndex("by_loanId", (q) => q.eq("loanId", loanId))
      .take(MAX_PAYOFF_LEDGER_ITEMS + 1),
    ctx.db
      .query("loanCharges")
      .withIndex("by_loanId", (q) => q.eq("loanId", loanId))
      .take(MAX_PAYOFF_LEDGER_ITEMS + 1),
  ]);

  const audience: "admin" | "borrower" =
    profile.role === "borrower" ? "borrower" : "admin";
  const readiness = evaluatePayoffReadiness({
    loan,
    draws,
    payments,
    charges,
    issueDate: getBusinessDate(),
    audience,
  });

  return { loan, draws, payments, charges, readiness, audience };
}

function publicError(code: string, publicMessage: string) {
  return new ConvexError({ code, publicMessage });
}

function buildPayoffStatement(
  context: Awaited<ReturnType<typeof getPayoffContext>>,
  goodThroughDate: string
) {
  if (context.readiness.state !== "ready") {
    throw new Error("Payoff is not ready");
  }

  const payoff = calculateDatedPayoff({
    loan: context.loan,
    draws: context.draws,
    payments: context.payments,
    charges: context.charges,
    goodThroughDate,
  });
  if (
    !Number.isFinite(payoff.totalPayoff) ||
    payoff.principal <= 0 ||
    payoff.principal > context.loan.loanAmount + 0.01
  ) {
    throw new Error("Loan principal balance is invalid");
  }

  return {
    issuedDate: context.readiness.issuedDate,
    goodThroughDate,
    borrowerName:
      context.loan.entityName.trim() || context.loan.borrowerName,
    propertyAddress: context.loan.propertyAddress,
    ...payoff,
  };
}

export const getPayoffReadiness = query({
  args: {
    loanId: v.id("loans"),
  },
  handler: async (ctx, args) => {
    const context = await getPayoffContext(ctx, args.loanId);
    if (context.readiness.state !== "ready") return context.readiness;

    try {
      return {
        ...context.readiness,
        statement: buildPayoffStatement(
          context,
          context.readiness.defaultGoodThroughDate
        ),
      };
    } catch {
      return getPayoffCalculationBlocked(
        context.readiness.issuedDate,
        context.audience
      );
    }
  },
});

export const getPayoffStatement = query({
  args: {
    loanId: v.id("loans"),
    goodThroughDate: v.string(),
  },
  handler: async (ctx, args) => {
    const { loan, draws, payments, charges, readiness, audience } =
      await getPayoffContext(ctx, args.loanId);
    if (readiness.state !== "ready") {
      const reason =
        readiness.state === "completed"
          ? {
              code: "PAYOFF_COMPLETED",
              message: `This loan was paid off on ${readiness.returnedDate}.`,
            }
          : {
              code: readiness.reasons[0]?.code ?? "PAYOFF_BLOCKED",
              message:
                readiness.reasons[0]?.message ??
                "This payoff is not currently available.",
            };
      throw publicError(reason.code, reason.message);
    }

    const goodThroughDate = parseUsDate(args.goodThroughDate);
    if (!goodThroughDate) {
      throw publicError(
        "INVALID_GOOD_THROUGH_DATE",
        "Enter a valid good-through date in MM/DD/YYYY format."
      );
    }

    const minDate = parseUsDate(readiness.minGoodThroughDate);
    const maxDate = readiness.maxGoodThroughDate
      ? parseUsDate(readiness.maxGoodThroughDate)
      : null;
    if (!minDate || goodThroughDate < minDate) {
      throw publicError(
        "GOOD_THROUGH_DATE_TOO_EARLY",
        `Good-through date must be ${readiness.minGoodThroughDate} or later.`
      );
    }
    if (maxDate && goodThroughDate > maxDate) {
      throw publicError(
        "GOOD_THROUGH_DATE_TOO_LATE",
        `Good-through date cannot be after ${readiness.maxGoodThroughDate}.`
      );
    }

    try {
      return buildPayoffStatement(
        { loan, draws, payments, charges, readiness, audience },
        args.goodThroughDate
      );
    } catch {
      throw publicError(
        "PAYOFF_CALCULATION_FAILED",
        "Unable to calculate this payoff. Review the loan financial history and try again."
      );
    }
  },
});
