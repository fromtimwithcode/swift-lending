import type { Doc } from "../_generated/dataModel";
import { isFundedLoanStatus } from "./constants";
import { formatUsDate, parseUsDate } from "./dates";
import {
  getFundingLedgerStatus,
  getPrincipalOutFromFundingLedger,
} from "./fundingLedger";

export const MAX_PAYOFF_LEDGER_ITEMS = 1_000;

type PayoffLoan = Pick<
  Doc<"loans">,
  | "status"
  | "returnedDate"
  | "loanAmount"
  | "drawFundsTotal"
  | "drawFundsUsed"
  | "interestRate"
  | "closeDate"
  | "maturityDate"
>;

type PayoffDraw = Pick<
  Doc<"drawRequests">,
  "amountRequested" | "status" | "wireDate"
>;

type PayoffPayment = Pick<
  Doc<"loanPayments">,
  "paymentDate" | "status"
>;

type PayoffCharge = Pick<Doc<"loanCharges">, "periodEnd">;

type Audience = "admin" | "borrower";

type PayoffIssue = {
  code: string;
  title: string;
  message: string;
  resolution: string;
  technical: boolean;
  borrowerTitle?: string;
  borrowerMessage?: string;
  borrowerResolution?: string;
};

type PayoffReason = Pick<
  PayoffIssue,
  "code" | "title" | "message" | "resolution"
>;

export type PayoffReadiness =
  | {
      state: "ready";
      issuedDate: string;
      defaultGoodThroughDate: string;
      minGoodThroughDate: string;
      maxGoodThroughDate: string | null;
    }
  | {
      state: "blocked";
      issuedDate: string;
      reasons: PayoffReason[];
    }
  | {
      state: "completed";
      issuedDate: string;
      returnedDate: string;
    };

type BlockedPayoffReadiness = Extract<
  PayoffReadiness,
  { state: "blocked" }
>;

function issue(
  code: string,
  title: string,
  message: string,
  resolution: string,
  options?: {
    technical?: boolean;
    borrowerTitle?: string;
    borrowerMessage?: string;
    borrowerResolution?: string;
  }
): PayoffIssue {
  return {
    code,
    title,
    message,
    resolution,
    technical: options?.technical ?? true,
    borrowerTitle: options?.borrowerTitle,
    borrowerMessage: options?.borrowerMessage,
    borrowerResolution: options?.borrowerResolution,
  };
}

function blocked(
  issuedDate: string,
  issues: PayoffIssue[],
  audience: Audience
): BlockedPayoffReadiness {
  if (audience === "borrower" && issues.some((item) => item.technical)) {
    return {
      state: "blocked",
      issuedDate,
      reasons: [
        {
          code: "LENDER_REVIEW_REQUIRED",
          title: "Payoff temporarily unavailable",
          message: "Your lending team needs to review this loan before a payoff statement can be issued.",
          resolution: "Contact your lending team for assistance.",
        },
      ],
    };
  }

  return {
    state: "blocked",
    issuedDate,
    reasons: issues.map((item) => ({
      code: item.code,
      title:
        audience === "borrower" ? item.borrowerTitle ?? item.title : item.title,
      message:
        audience === "borrower"
          ? item.borrowerMessage ?? item.message
          : item.message,
      resolution:
        audience === "borrower"
          ? item.borrowerResolution ?? item.resolution
          : item.resolution,
    })),
  };
}

export function getPayoffCalculationBlocked(
  issuedDate: string,
  audience: Audience
) {
  return blocked(
    issuedDate,
    [
      issue(
        "PAYOFF_CALCULATION_FAILED",
        "Financial history needs attention",
        "The saved loan activity could not produce a valid payoff amount.",
        "Review the loan terms, funding, payments, and charge history."
      ),
    ],
    audience
  );
}

export function evaluatePayoffReadiness(args: {
  loan: PayoffLoan;
  draws: PayoffDraw[];
  payments: PayoffPayment[];
  charges: PayoffCharge[];
  issueDate: Date;
  audience: Audience;
}): PayoffReadiness {
  const issueDate = new Date(args.issueDate);
  issueDate.setHours(0, 0, 0, 0);
  const issuedDate = formatUsDate(issueDate);

  if (args.loan.returnedDate) {
    return {
      state: "completed",
      issuedDate,
      returnedDate: args.loan.returnedDate,
    };
  }

  if (!isFundedLoanStatus(args.loan.status) || !args.loan.closeDate) {
    return blocked(
      issuedDate,
      [
        issue(
          "NOT_FUNDED",
          "Not available yet",
          "A payoff statement becomes available after the loan is funded and a closing date is recorded.",
          "Complete the funding process first.",
          { technical: false }
        ),
      ],
      args.audience
    );
  }

  const issues: PayoffIssue[] = [];
  const closeDate = parseUsDate(args.loan.closeDate);
  const maturityDate = args.loan.maturityDate
    ? parseUsDate(args.loan.maturityDate)
    : null;

  if (
    !Number.isFinite(args.loan.loanAmount) ||
    args.loan.loanAmount <= 0 ||
    !Number.isFinite(args.loan.interestRate) ||
    args.loan.interestRate <= 0
  ) {
    issues.push(
      issue(
        "FINANCIAL_TERMS_INCOMPLETE",
        "Loan terms need attention",
        "The loan amount and interest rate must both be valid values greater than zero.",
        "Edit the loan terms before generating a payoff."
      )
    );
  }

  if (!closeDate) {
    issues.push(
      issue(
        "CLOSE_DATE_INVALID",
        "Closing date needs attention",
        "The saved closing date is missing or invalid.",
        "Correct the closing date in the loan details."
      )
    );
  }

  if (args.loan.maturityDate && !maturityDate) {
    issues.push(
      issue(
        "MATURITY_DATE_INVALID",
        "Maturity date needs attention",
        "The saved maturity date is invalid.",
        "Correct the maturity date in the loan details."
      )
    );
  }

  if (issues.length > 0 || !closeDate) {
    return blocked(issuedDate, issues, args.audience);
  }

  const minDate = issueDate > closeDate ? issueDate : closeDate;
  if (maturityDate && minDate > maturityDate) {
    return blocked(
      issuedDate,
      [
        issue(
          "PAST_MATURITY",
          "Maturity review required",
          `This loan matured on ${args.loan.maturityDate}. A payoff cannot be issued under the current terms.`,
          "Confirm the post-maturity terms before issuing a payoff.",
          {
            technical: false,
            borrowerTitle: "Contact your lending team",
            borrowerMessage: `This loan matured on ${args.loan.maturityDate}. Your lending team must review the payoff terms.`,
            borrowerResolution: "Contact your lending team for an updated payoff.",
          }
        ),
      ],
      args.audience
    );
  }

  if (
    args.draws.length > MAX_PAYOFF_LEDGER_ITEMS ||
    args.payments.length > MAX_PAYOFF_LEDGER_ITEMS ||
    args.charges.length > MAX_PAYOFF_LEDGER_ITEMS
  ) {
    return blocked(
      issuedDate,
      [
        issue(
          "LEDGER_LIMIT_EXCEEDED",
          "Payoff needs support",
          "This loan has more financial activity than can be safely calculated in one request.",
          "Contact support to prepare this payoff."
        ),
      ],
      args.audience
    );
  }

  const funding = getFundingLedgerStatus({
    savedDrawFundsUsed: args.loan.drawFundsUsed,
    draws: args.draws,
  });

  if (Math.abs(funding.difference) > 0.01) {
    issues.push(
      issue(
        "FUNDING_LEDGER_MISMATCH",
        "Funding history needs reconciliation",
        "The saved funded total does not match the approved funding records.",
        "Review and reconcile the funding history."
      )
    );
  }

  if (funding.undatedApprovedCount > 0) {
    issues.push(
      issue(
        "APPROVED_DRAW_DATE_INVALID",
        "Funding dates need attention",
        `${funding.undatedApprovedCount} approved funding ${funding.undatedApprovedCount === 1 ? "record is" : "records are"} missing a valid wire date.`,
        "Correct the approved funding dates."
      )
    );
  }

  const approvedDrawDates = args.draws
    .filter((draw) => draw.status === "approved" && draw.wireDate)
    .map((draw) => parseUsDate(draw.wireDate ?? ""))
    .filter((date): date is Date => date !== null);

  if (approvedDrawDates.some((date) => date < closeDate)) {
    issues.push(
      issue(
        "APPROVED_DRAW_BEFORE_CLOSE",
        "Funding dates need attention",
        "An approved funding record is dated before the loan closing date.",
        "Correct the approved funding dates."
      )
    );
  }

  if (maturityDate && approvedDrawDates.some((date) => date > maturityDate)) {
    issues.push(
      issue(
        "APPROVED_DRAW_AFTER_MATURITY",
        "Funding dates need attention",
        "An approved funding record is dated after the loan maturity date.",
        "Correct the approved funding dates."
      )
    );
  }

  if (
    args.payments.some(
      (payment) =>
        payment.status !== "missed" && !parseUsDate(payment.paymentDate)
    )
  ) {
    issues.push(
      issue(
        "PAYMENT_DATE_INVALID",
        "Payment dates need attention",
        "A recorded payment has an invalid payment date.",
        "Correct the payment history before generating a payoff."
      )
    );
  }

  if (args.charges.some((charge) => !parseUsDate(charge.periodEnd))) {
    issues.push(
      issue(
        "CHARGE_DATE_INVALID",
        "Charge dates need attention",
        "A loan charge has an invalid period end date.",
        "Correct the charge schedule before generating a payoff."
      )
    );
  }

  if (issues.length === 0) {
    const principal = getPrincipalOutFromFundingLedger(args.loan, args.draws);
    if (
      !Number.isFinite(principal) ||
      principal <= 0 ||
      principal > args.loan.loanAmount + 0.01
    ) {
      issues.push(
        issue(
          "PRINCIPAL_INVALID",
          "Principal balance needs attention",
          "The calculated principal balance is outside the valid loan amount.",
          "Review the loan amount and funding history."
        )
      );
    }
  }

  if (issues.length > 0) {
    return blocked(issuedDate, issues, args.audience);
  }

  const defaultGoodThroughDate = formatUsDate(minDate);
  return {
    state: "ready",
    issuedDate,
    defaultGoodThroughDate,
    minGoodThroughDate: defaultGoodThroughDate,
    maxGoodThroughDate: maturityDate ? formatUsDate(maturityDate) : null,
  };
}
