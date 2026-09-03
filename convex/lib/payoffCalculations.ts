import type { Doc } from "../_generated/dataModel";
import { parseUsDate } from "./dates";
import { getCurrentPrincipalOut } from "./loanCalculations";
import { roundCents } from "./financialRules";
import {
  FUNDING_LEDGER_ERROR,
  getFundingLedgerStatus,
} from "./fundingLedger";

type PayoffLoan = Pick<
  Doc<"loans">,
  "loanAmount" | "drawFundsTotal" | "drawFundsUsed" | "interestRate" | "closeDate"
>;
type PayoffDraw = Pick<
  Doc<"drawRequests">,
  "amountRequested" | "status" | "wireDate"
>;
type PayoffPayment = Pick<
  Doc<"loanPayments">,
  "amount" | "paymentDate" | "dueDate" | "status"
>;
type PayoffCharge = Pick<
  Doc<"loanCharges">,
  "amount" | "dueDate" | "periodEnd" | "status" | "type"
>;

export type DatedPayoff = {
  principal: number;
  grossAccruedInterest: number;
  interestCredits: number;
  unpaidInterest: number;
  totalPayoff: number;
  perDiemInterest: number;
};

function payoffDayNumber(date: Date) {
  return date.getFullYear() * 360 + date.getMonth() * 30 + date.getDate();
}

function getPayoffDays(start: Date, end: Date) {
  return Math.max(0, payoffDayNumber(end) - payoffDayNumber(start));
}

function requireDate(value: string | undefined, label: string) {
  const date = value ? parseUsDate(value) : null;
  if (!date) throw new Error(`${label} is invalid`);
  return date;
}

/**
 * Calculates a formal dated payoff using the loan's 30/360 convention.
 * Interest is segmented at each funded draw so later advances are not treated
 * as outstanding for the entire loan term.
 */
export function calculateDatedPayoff(args: {
  loan: PayoffLoan;
  draws: PayoffDraw[];
  payments: PayoffPayment[];
  charges: PayoffCharge[];
  goodThroughDate: string;
}): DatedPayoff {
  const closeDate = requireDate(args.loan.closeDate, "Close date");
  const goodThroughDate = requireDate(args.goodThroughDate, "Good-through date");
  if (goodThroughDate < closeDate) {
    throw new Error("Good-through date cannot be before the close date");
  }

  const initialPrincipal = getCurrentPrincipalOut({
    loanAmount: args.loan.loanAmount,
    drawFundsTotal: args.loan.drawFundsTotal,
    drawFundsUsed: 0,
  });
  const fundedDraws = args.draws
    .filter((draw) => draw.status === "approved")
    .map((draw) => ({
      amount: draw.amountRequested,
      date: requireDate(draw.wireDate, "Approved draw wire date"),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const ledgerStatus = getFundingLedgerStatus({
    savedDrawFundsUsed: args.loan.drawFundsUsed,
    draws: args.draws,
  });
  if (!ledgerStatus.isReconciled) {
    throw new Error(FUNDING_LEDGER_ERROR);
  }

  const dailyRate = args.loan.interestRate / 100 / 360;
  let principal = initialPrincipal;
  let periodStart = closeDate;
  let grossAccruedInterest = 0;

  for (const draw of fundedDraws) {
    if (draw.date < closeDate) {
      throw new Error("Approved draw wire date cannot be before the close date");
    }
    if (draw.date > goodThroughDate) break;

    grossAccruedInterest += principal * dailyRate * getPayoffDays(periodStart, draw.date);
    principal = roundCents(principal + draw.amount);
    periodStart = draw.date;
  }

  grossAccruedInterest +=
    principal * dailyRate * getPayoffDays(periodStart, goodThroughDate);

  const eligiblePayments = args.payments.filter((payment) => {
    if (payment.status === "missed") return false;
    return requireDate(payment.paymentDate, "Payment date") <= goodThroughDate;
  });
  const paymentCredits = eligiblePayments.reduce(
    (sum, payment) => sum + payment.amount,
    0
  );
  const paymentsByDueDate = new Map<string, number>();
  for (const payment of eligiblePayments) {
    paymentsByDueDate.set(
      payment.dueDate,
      (paymentsByDueDate.get(payment.dueDate) ?? 0) + payment.amount
    );
  }

  const paidChargesByDueDate = new Map<string, number>();
  let waivedCredits = 0;
  for (const charge of args.charges) {
    const isThroughPayoffDate =
      requireDate(charge.periodEnd, "Charge period end") <= goodThroughDate;
    if (charge.status === "waived") {
      if (isThroughPayoffDate) waivedCredits += charge.amount;
    } else if (
      charge.status === "paid" &&
      (charge.type === "prepaid_interest" || isThroughPayoffDate)
    ) {
      paidChargesByDueDate.set(
        charge.dueDate,
        (paidChargesByDueDate.get(charge.dueDate) ?? 0) + charge.amount
      );
    }
  }

  let paidStatusCredits = 0;
  for (const [dueDate, paidChargeAmount] of paidChargesByDueDate) {
    paidStatusCredits += Math.max(
      0,
      paidChargeAmount - (paymentsByDueDate.get(dueDate) ?? 0)
    );
  }

  const roundedGrossInterest = roundCents(grossAccruedInterest);
  const interestCredits = roundCents(
    paymentCredits + paidStatusCredits + waivedCredits
  );
  const unpaidInterest = Math.max(
    0,
    roundCents(roundedGrossInterest - interestCredits)
  );

  return {
    principal,
    grossAccruedInterest: roundedGrossInterest,
    interestCredits,
    unpaidInterest,
    totalPayoff: roundCents(principal + unpaidInterest),
    perDiemInterest: roundCents(principal * dailyRate),
  };
}
