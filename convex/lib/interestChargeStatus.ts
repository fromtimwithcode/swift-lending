import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  isCombinedInterestChargeType,
  PAYMENT_MATCH_TOLERANCE,
} from "./financialRules";
import { roundCents } from "./loanCalculations";

type LoanPaymentDoc = Doc<"loanPayments">;
type LoanChargeDoc = Doc<"loanCharges">;

export function getEligiblePaymentAmount(payment: LoanPaymentDoc) {
  return payment.status === "missed" ? 0 : payment.amount;
}

export function getPaidAmountForInterestGroup(
  payments: LoanPaymentDoc[],
  charges: LoanChargeDoc[],
  dueDate: string
) {
  const chargeIds = new Set(charges.map((charge) => charge._id));
  return payments.reduce((sum, payment) => {
    if (payment.dueDate !== dueDate || payment.status === "missed") return sum;
    if (payment.chargeId && !chargeIds.has(payment.chargeId)) return sum;
    return sum + payment.amount;
  }, 0);
}

export async function syncInterestChargeStatusesForDueDate(
  ctx: MutationCtx,
  args: {
    loanId: Id<"loans">;
    dueDate: string;
  }
) {
  const charges = await ctx.db
    .query("loanCharges")
    .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
    .collect();
  const interestCharges = charges.filter(
    (charge) =>
      charge.dueDate === args.dueDate &&
      charge.status !== "waived" &&
      isCombinedInterestChargeType(charge.type)
  );
  if (interestCharges.length === 0) return { allPaid: false };

  const payments = await ctx.db
    .query("loanPayments")
    .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
    .collect();
  const totalAmount = roundCents(interestCharges.reduce((sum, charge) => sum + charge.amount, 0));
  const totalPaidForDueDate = roundCents(
    getPaidAmountForInterestGroup(payments, interestCharges, args.dueDate)
  );
  const groupPaid = totalPaidForDueDate + PAYMENT_MATCH_TOLERANCE >= totalAmount;
  let allPaid = true;

  for (const charge of interestCharges) {
    const directlyPaid = roundCents(
      payments.reduce((sum, payment) => {
        if (payment.chargeId !== charge._id) return sum;
        return sum + getEligiblePaymentAmount(payment);
      }, 0)
    );
    const nextStatus =
      groupPaid || directlyPaid + PAYMENT_MATCH_TOLERANCE >= charge.amount
        ? "paid"
        : "scheduled";
    if (nextStatus !== "paid") allPaid = false;
    if (charge.status !== nextStatus) {
      await ctx.db.patch(charge._id, { status: nextStatus });
    }
  }

  return { allPaid };
}
