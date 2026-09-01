import { describe, expect, test } from "vitest";
import {
  getApprovedDrawTotal,
  getFundingLedgerStatus,
  getPrincipalOutForPeriodStart,
} from "./fundingLedger";

const draws = [
  { amountRequested: 4_806.29, status: "approved", wireDate: "07/01/2026" },
  { amountRequested: 8_730.71, status: "approved", wireDate: "07/31/2026" },
  { amountRequested: 4_892.65, status: "approved", wireDate: "08/18/2026" },
  { amountRequested: 1_000, status: "pending" },
];

describe("funding ledger", () => {
  test("uses approved records as the funded total", () => {
    expect(getApprovedDrawTotal(draws)).toBe(18_429.65);
    expect(
      getFundingLedgerStatus({ savedDrawFundsUsed: 51_568, draws })
    ).toMatchObject({
      savedTotal: 51_568,
      recordedTotal: 18_429.65,
      difference: 33_138.35,
      isReconciled: false,
    });
  });

  test("calculates period principal only from draws funded before the period", () => {
    expect(
      getPrincipalOutForPeriodStart(
        { loanAmount: 448_000, drawFundsTotal: 62_400 },
        draws,
        new Date(2026, 7, 1)
      )
    ).toBe(399_137);
  });

  test("requires every approved draw to have a valid wire date", () => {
    expect(
      getFundingLedgerStatus({
        savedDrawFundsUsed: 100,
        draws: [{ amountRequested: 100, status: "approved" }],
      })
    ).toMatchObject({ undatedApprovedCount: 1, isReconciled: false });
  });
});
