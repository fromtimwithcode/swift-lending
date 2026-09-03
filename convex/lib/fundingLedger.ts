import { parseUsDate } from "./dates";
import { roundCents } from "./financialRules";
import { getCurrentPrincipalOut } from "./loanCalculations";

export const FUNDING_LEDGER_ERROR =
  "Funding history needs reconciliation before charges or payoff can be calculated. Contact an administrator.";

type FundingDraw = {
  amountRequested: number;
  status: string;
  wireDate?: string;
  source?: string;
};

type FundingLoan = {
  loanAmount: number;
  drawFundsTotal?: number;
  drawFundsUsed?: number;
};

export function getApprovedDrawTotal(draws: FundingDraw[]) {
  return roundCents(
    draws.reduce(
      (total, draw) =>
        draw.status === "approved" ? total + draw.amountRequested : total,
      0
    )
  );
}

export function getFundingLedgerStatus(args: {
  savedDrawFundsUsed?: number;
  draws: FundingDraw[];
}) {
  const savedTotal = roundCents(args.savedDrawFundsUsed ?? 0);
  const recordedTotal = getApprovedDrawTotal(args.draws);
  const difference = roundCents(savedTotal - recordedTotal);
  const undatedApprovedCount = args.draws.filter(
    (draw) =>
      draw.status === "approved" &&
      (!draw.wireDate || !parseUsDate(draw.wireDate))
  ).length;

  return {
    savedTotal,
    recordedTotal,
    difference,
    undatedApprovedCount,
    isReconciled: Math.abs(difference) <= 0.01 && undatedApprovedCount === 0,
  };
}

export function getPrincipalOutFromFundingLedger(
  loan: FundingLoan,
  draws: FundingDraw[]
) {
  return getCurrentPrincipalOut({
    loanAmount: loan.loanAmount,
    drawFundsTotal: loan.drawFundsTotal,
    drawFundsUsed: getApprovedDrawTotal(draws),
  });
}

export function getPrincipalOutForPeriodStart(
  loan: FundingLoan,
  draws: FundingDraw[],
  periodStart: Date,
  includePeriodStart = false
) {
  const fundedBeforePeriod = roundCents(
    draws.reduce((total, draw) => {
      if (draw.status !== "approved" || !draw.wireDate) return total;
      const wireDate = parseUsDate(draw.wireDate);
      const isFunded = wireDate && (
        wireDate < periodStart ||
        (includePeriodStart && wireDate.getTime() === periodStart.getTime())
      );
      return isFunded
        ? total + draw.amountRequested
        : total;
    }, 0)
  );

  return getCurrentPrincipalOut({
    loanAmount: loan.loanAmount,
    drawFundsTotal: loan.drawFundsTotal,
    drawFundsUsed: fundedBeforePeriod,
  });
}
