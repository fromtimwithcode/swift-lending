import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import { requireAnyRole } from "./lib/auth";
import { formatUsDate, parseUsDate, validateUsDate } from "./lib/dates";
import { calculateDatedPayoff } from "./lib/payoffCalculations";
import { isFundedLoanStatus } from "./lib/constants";

const MAX_LEDGER_ITEMS = 1_000;

export const getPayoffStatement = query({
  args: {
    loanId: v.id("loans"),
    goodThroughDate: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await requireAnyRole(ctx, ["admin", "borrower"]);
    const loan = await ctx.db.get(args.loanId);
    if (!loan) throw new ConvexError("Loan not found");
    if (profile.role === "borrower" && loan.borrowerId !== profile._id) {
      throw new ConvexError("Not your loan");
    }
    if (!isFundedLoanStatus(loan.status) || !loan.closeDate) {
      throw new ConvexError("A payoff is only available after the loan is funded");
    }
    if (loan.returnedDate) {
      throw new ConvexError("This loan has already been paid off");
    }
    if (loan.loanAmount <= 0 || loan.interestRate <= 0) {
      throw new ConvexError("Loan financial terms are incomplete");
    }

    const goodThroughDate = validateUsDate(
      args.goodThroughDate,
      "Good-through date",
      { allowFuture: true }
    );
    const issueDate = new Date();
    issueDate.setHours(0, 0, 0, 0);
    if (goodThroughDate < issueDate) {
      throw new ConvexError("Good-through date cannot be before today");
    }

    const closeDate = parseUsDate(loan.closeDate);
    if (!closeDate) throw new ConvexError("Loan close date is invalid");
    if (goodThroughDate < closeDate) {
      throw new ConvexError("Good-through date cannot be before the close date");
    }

    if (loan.maturityDate) {
      const maturityDate = parseUsDate(loan.maturityDate);
      if (!maturityDate) throw new ConvexError("Loan maturity date is invalid");
      if (goodThroughDate > maturityDate) {
        throw new ConvexError("Good-through date cannot be after the maturity date");
      }
    }

    const [draws, payments, charges] = await Promise.all([
      ctx.db
        .query("drawRequests")
        .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
        .take(MAX_LEDGER_ITEMS + 1),
      ctx.db
        .query("loanPayments")
        .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
        .take(MAX_LEDGER_ITEMS + 1),
      ctx.db
        .query("loanCharges")
        .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
        .take(MAX_LEDGER_ITEMS + 1),
    ]);
    if ([draws, payments, charges].some((rows) => rows.length > MAX_LEDGER_ITEMS)) {
      throw new ConvexError("This loan has too much ledger activity to calculate safely");
    }

    let payoff;
    try {
      payoff = calculateDatedPayoff({
        loan,
        draws,
        payments,
        charges,
        goodThroughDate: args.goodThroughDate,
      });
      if (payoff.principal <= 0 || payoff.principal > loan.loanAmount + 0.01) {
        throw new Error("Loan principal balance is invalid");
      }
    } catch (error) {
      throw new ConvexError(
        error instanceof Error ? error.message : "Unable to calculate payoff"
      );
    }

    return {
      issuedDate: formatUsDate(issueDate),
      goodThroughDate: args.goodThroughDate,
      borrowerName: loan.entityName.trim() || loan.borrowerName,
      propertyAddress: loan.propertyAddress,
      ...payoff,
    };
  },
});
