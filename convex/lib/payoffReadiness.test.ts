import { describe, expect, test } from "vitest";
import {
  evaluatePayoffReadiness,
  getPayoffCalculationBlocked,
} from "./payoffReadiness";

type ReadinessArgs = Parameters<typeof evaluatePayoffReadiness>[0];

const loan: ReadinessArgs["loan"] = {
  status: "funded",
  returnedDate: undefined,
  loanAmount: 150_000,
  drawFundsTotal: 50_000,
  drawFundsUsed: 50_000,
  interestRate: 12,
  closeDate: "01/01/2026",
  maturityDate: "12/31/2026",
};

const draws: ReadinessArgs["draws"] = [
  {
    amountRequested: 50_000,
    status: "approved",
    wireDate: "02/01/2026",
  },
];

function evaluate(overrides?: {
  loan?: Partial<ReadinessArgs["loan"]>;
  draws?: ReadinessArgs["draws"];
  payments?: ReadinessArgs["payments"];
  charges?: ReadinessArgs["charges"];
  audience?: "admin" | "borrower";
}) {
  return evaluatePayoffReadiness({
    loan: { ...loan, ...overrides?.loan },
    draws: overrides?.draws ?? draws,
    payments: overrides?.payments ?? [],
    charges: overrides?.charges ?? [],
    issueDate: new Date(2026, 8, 4),
    audience: overrides?.audience ?? "admin",
  });
}

describe("payoff readiness", () => {
  test("returns a server-owned date window for a ready loan", () => {
    expect(evaluate()).toEqual({
      state: "ready",
      issuedDate: "09/04/2026",
      defaultGoodThroughDate: "09/04/2026",
      minGoodThroughDate: "09/04/2026",
      maxGoodThroughDate: "12/31/2026",
    });
  });

  test("uses a future close date as the earliest statement date", () => {
    expect(
      evaluate({
        loan: {
          closeDate: "10/01/2026",
          maturityDate: "12/31/2026",
          drawFundsUsed: 0,
        },
        draws: [],
      })
    ).toMatchObject({
      state: "ready",
      defaultGoodThroughDate: "10/01/2026",
      minGoodThroughDate: "10/01/2026",
    });
  });

  test("keeps lifecycle blockers understandable to borrowers", () => {
    expect(
      evaluate({
        loan: { status: "approved", closeDate: undefined },
        draws: [],
        audience: "borrower",
      })
    ).toMatchObject({
      state: "blocked",
      reasons: [
        {
          code: "NOT_FUNDED",
          title: "Not available yet",
        },
      ],
    });
  });

  test("returns a completed state for paid-off loans", () => {
    expect(
      evaluate({ loan: { returnedDate: "08/30/2026" } })
    ).toEqual({
      state: "completed",
      issuedDate: "09/04/2026",
      returnedDate: "08/30/2026",
    });
  });

  test("returns exact data issues to administrators", () => {
    const result = evaluate({
      loan: { drawFundsUsed: 10_000 },
      draws: [
        {
          amountRequested: 5_000,
          status: "approved",
          wireDate: "not-a-date",
        },
      ],
      payments: [{ paymentDate: "13/01/2026", status: "on_time" }],
      charges: [{ periodEnd: "02/30/2026" }],
    });

    expect(result.state).toBe("blocked");
    if (result.state !== "blocked") return;
    expect(result.reasons.map((reason) => reason.code)).toEqual([
      "FUNDING_LEDGER_MISMATCH",
      "APPROVED_DRAW_DATE_INVALID",
      "PAYMENT_DATE_INVALID",
      "CHARGE_DATE_INVALID",
    ]);
  });

  test("redacts technical data issues for borrowers", () => {
    expect(
      evaluate({
        loan: { drawFundsUsed: 10_000 },
        draws: [],
        audience: "borrower",
      })
    ).toEqual({
      state: "blocked",
      issuedDate: "09/04/2026",
      reasons: [
        {
          code: "LENDER_REVIEW_REQUIRED",
          title: "Payoff temporarily unavailable",
          message: "Your lending team needs to review this loan before a payoff statement can be issued.",
          resolution: "Contact your lending team for assistance.",
        },
      ],
    });
  });

  test("provides role-appropriate maturity guidance", () => {
    const admin = evaluate({
      loan: { maturityDate: "08/31/2026" },
    });
    const borrower = evaluate({
      loan: { maturityDate: "08/31/2026" },
      audience: "borrower",
    });

    expect(admin).toMatchObject({
      state: "blocked",
      reasons: [
        {
          code: "PAST_MATURITY",
          title: "Maturity review required",
        },
      ],
    });
    expect(borrower).toMatchObject({
      state: "blocked",
      reasons: [
        {
          code: "PAST_MATURITY",
          title: "Contact your lending team",
        },
      ],
    });
  });

  test("keeps calculation failures role-safe", () => {
    expect(getPayoffCalculationBlocked("09/04/2026", "admin")).toMatchObject({
      reasons: [{ code: "PAYOFF_CALCULATION_FAILED" }],
    });
    expect(
      getPayoffCalculationBlocked("09/04/2026", "borrower")
    ).toMatchObject({
      reasons: [{ code: "LENDER_REVIEW_REQUIRED" }],
    });
  });
});
