import { describe, expect, test } from "vitest";
import {
  calculateDrawProration,
  calculateMonthlyInterest,
  calculateMonthlyPaymentDue,
  getCurrentPrincipalOut,
} from "./loanCalculations";

describe("loan calculations", () => {
  test("matches the production example monthly interest to the cent", () => {
    expect(calculateMonthlyInterest(392_615.08, 13)).toBe(4_253.33);
  });

  test("uses current principal out for monthly interest", () => {
    const principalOut = getCurrentPrincipalOut({
      loanAmount: 448_000,
      drawFundsTotal: 78_000,
      drawFundsUsed: 53_544.64,
    });

    expect(principalOut).toBe(423_544.64);
    expect(calculateMonthlyInterest(principalOut, 13)).toBe(4_588.4);
    expect(
      calculateMonthlyPaymentDue({
        principalOut,
        annualRate: 13,
        paymentType: "monthly",
      })
    ).toBe(4_588.4);
  });

  test("does not charge an unfunded construction holdback", () => {
    const principalOut = getCurrentPrincipalOut({
      loanAmount: 190_000,
      drawFundsTotal: 55_000,
      drawFundsUsed: 27_500,
    });

    expect(principalOut).toBe(162_500);
    expect(calculateMonthlyInterest(principalOut, 13)).toBe(1_760.42);
  });

  test("prorates a funded draw from wire date through month end", () => {
    expect(
      calculateDrawProration({
        drawAmount: 10_000,
        annualRate: 12,
        wireDate: "07/16/2026",
        paymentDueDay: 1,
      })
    ).toMatchObject({
      amount: 51.68,
      daysCharged: 16,
      dueDate: "08/01/2026",
    });
  });

  test("sets balloon monthly payments to zero", () => {
    expect(
      calculateMonthlyPaymentDue({
        principalOut: 250_000,
        annualRate: 13,
        paymentType: "balloon",
      })
    ).toBe(0);
  });
});
