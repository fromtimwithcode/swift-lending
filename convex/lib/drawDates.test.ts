import { describe, expect, test } from "vitest";
import {
  getDrawWireDateError,
  validateDrawWireDateForLoan,
} from "./drawDates";

describe("draw wire date validation", () => {
  const loan = {
    closeDate: "01/15/2026",
    maturityDate: "07/15/2026",
  };

  test("accepts a funded-date draw within the loan term", () => {
    expect(getDrawWireDateError(loan, "03/10/2026")).toBeNull();
  });

  test("requires a loan closing date", () => {
    expect(getDrawWireDateError({}, "03/10/2026")).toBe(
      "Loan must have a closing date before a draw can be approved"
    );
  });

  test("rejects wire dates outside the loan term", () => {
    expect(getDrawWireDateError(loan, "01/14/2026")).toBe(
      "Wire date cannot be before the loan closing date"
    );
    expect(getDrawWireDateError(loan, "07/16/2026")).toBe(
      "Wire date cannot be after the loan maturity date"
    );
  });

  test("rejects future dates before financial records are changed", () => {
    expect(() => validateDrawWireDateForLoan(loan, "01/01/2099")).toThrow(
      "Wire date cannot be in the future"
    );
  });
});
