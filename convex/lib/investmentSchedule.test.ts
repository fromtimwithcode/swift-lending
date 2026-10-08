import { describe, expect, test } from "vitest";
import {
  addCalendarMonths,
  formatCalendarDay,
  getBusinessCalendarDay,
  getInvestmentTermsError,
  getPaymentDayLabel,
  getPayoutError,
  parseIsoCalendarDay,
  summarizeInvestment,
  toIsoCalendarDay,
  type InvestmentTerms,
} from "./investmentSchedule";

function day(iso: string) {
  const value = parseIsoCalendarDay(iso);
  if (value === null) throw new Error(`Invalid test date ${iso}`);
  return value;
}

const terms: InvestmentTerms = {
  investmentAmount: 100_000,
  interestRate: 10,
  inceptionDate: day("2026-10-12"),
  firstPaymentDate: day("2026-11-12"),
  priorPaymentsReceived: 0,
};

describe("calendar days", () => {
  test("show the date the admin picked in every timezone", () => {
    expect(formatCalendarDay(day("2026-10-12"))).toBe("10/12/2026");
    expect(toIsoCalendarDay(day("2026-10-12"))).toBe("2026-10-12");
  });

  test("reject impossible dates", () => {
    expect(parseIsoCalendarDay("2026-02-30")).toBeNull();
    expect(parseIsoCalendarDay("10/12/2026")).toBeNull();
  });

  test("use the Wisconsin date for today", () => {
    expect(getBusinessCalendarDay(new Date("2026-09-05T00:30:00.000Z"))).toBe(day("2026-09-04"));
  });

  test("clamp month-end dates without drifting", () => {
    const anchor = day("2027-01-31");
    expect(formatCalendarDay(addCalendarMonths(anchor, 1))).toBe("02/28/2027");
    expect(formatCalendarDay(addCalendarMonths(anchor, 2))).toBe("03/31/2027");
  });
});

describe("investment summary", () => {
  test("a full first month pays amount × rate ÷ 12", () => {
    const summary = summarizeInvestment(terms, [], day("2026-10-08"));
    expect(summary).toEqual({
      monthlyPayment: 833.33,
      annualInterest: 10_000,
      interestEarned: 0,
      paidToDate: 0,
      unpaidInterest: 0,
      pastDue: null,
      nextPayment: { amount: 833.33, dueDate: day("2026-11-12") },
    });
  });

  test("interest accrues daily within the current period", () => {
    const summary = summarizeInvestment(terms, [], day("2026-10-27"));
    expect(summary.interestEarned).toBe(403.22);
    expect(summary.unpaidInterest).toBe(403.22);
    expect(summary.nextPayment).toEqual({ amount: 833.33, dueDate: day("2026-11-12") });
  });

  test("a payment due today is the next payment, not past due", () => {
    const summary = summarizeInvestment(terms, [], day("2026-11-12"));
    expect(summary.interestEarned).toBe(833.33);
    expect(summary.pastDue).toBeNull();
    expect(summary.nextPayment).toEqual({ amount: 833.33, dueDate: day("2026-11-12") });
  });

  test("a short first period is prorated at 30 days per month", () => {
    const summary = summarizeInvestment(
      { ...terms, firstPaymentDate: day("2026-11-01") },
      [],
      day("2026-10-12"),
    );
    expect(summary.nextPayment).toEqual({ amount: 555.56, dueDate: day("2026-11-01") });
  });

  test("a long first period adds whole months and leftover days", () => {
    const summary = summarizeInvestment(
      { ...terms, firstPaymentDate: day("2026-12-01") },
      [],
      day("2026-10-12"),
    );
    expect(summary.nextPayment?.amount).toBe(1361.11);
  });

  test("payments cover the oldest scheduled payment first", () => {
    const summary = summarizeInvestment(terms, [833.33, 500], day("2027-01-05"));
    expect(summary.paidToDate).toBe(1333.33);
    expect(summary.interestEarned).toBe(2311.82);
    expect(summary.unpaidInterest).toBe(978.49);
    expect(summary.pastDue).toEqual({ amount: 333.33, since: day("2026-12-12") });
    expect(summary.nextPayment).toEqual({ amount: 833.33, dueDate: day("2027-01-12") });
  });

  test("payments received before tracking count toward paid to date", () => {
    const summary = summarizeInvestment(
      { ...terms, priorPaymentsReceived: 1666.66 },
      [],
      day("2027-01-05"),
    );
    expect(summary.pastDue).toBeNull();
    expect(summary.nextPayment).toEqual({ amount: 833.33, dueDate: day("2027-01-12") });
  });

  test("a prepaid payment moves the next payment forward", () => {
    const summary = summarizeInvestment(terms, [833.33], day("2026-11-01"));
    expect(summary.unpaidInterest).toBe(0);
    expect(summary.nextPayment).toEqual({ amount: 833.33, dueDate: day("2026-12-12") });
  });

  test("a 0% investment has no payments", () => {
    const summary = summarizeInvestment({ ...terms, interestRate: 0 }, [], day("2027-01-05"));
    expect(summary.monthlyPayment).toBe(0);
    expect(summary.nextPayment).toBeNull();
    expect(summary.pastDue).toBeNull();
  });

  test("a future inception has earned nothing yet", () => {
    const summary = summarizeInvestment(terms, [], day("2026-09-01"));
    expect(summary.interestEarned).toBe(0);
    expect(summary.nextPayment?.dueDate).toBe(day("2026-11-12"));
  });
});

describe("validation", () => {
  test("accepts valid terms", () => {
    expect(getInvestmentTermsError(terms)).toBeNull();
  });

  test.each([
    [{ investmentAmount: 0 }, "Enter an investment amount greater than $0."],
    [{ interestRate: -1 }, "Enter an annual rate from 0% to 100%."],
    [{ interestRate: Number.NaN }, "Enter an annual rate from 0% to 100%."],
    [{ inceptionDate: day("2026-10-12") + 1 }, "Choose an inception date."],
    [{ firstPaymentDate: day("2026-10-12") }, "The first payment date must be after the inception date."],
    [{ priorPaymentsReceived: -5 }, "Payments received before tracking can't be negative."],
  ] satisfies [Partial<InvestmentTerms>, string][])("rejects %o", (patch, message) => {
    expect(getInvestmentTermsError({ ...terms, ...patch })).toEqual({
      field: Object.keys(patch)[0],
      message,
    });
  });

  test("rejects payouts that are empty, future, or before inception", () => {
    const today = day("2026-12-01");
    expect(getPayoutError({ amount: 833.33, paidDate: day("2026-11-12") }, terms, today)).toBeNull();
    expect(getPayoutError({ amount: 0, paidDate: day("2026-11-12") }, terms, today)).toEqual({
      field: "amount",
      message: "Enter a payment amount greater than $0.",
    });
    expect(getPayoutError({ amount: 10, paidDate: day("2026-12-02") }, terms, today)).toEqual({
      field: "paidDate",
      message: "The payment date can't be in the future.",
    });
    expect(getPayoutError({ amount: 10, paidDate: day("2026-10-01") }, terms, today)).toEqual({
      field: "paidDate",
      message: "The payment date can't be before the inception date.",
    });
  });
});

test.each([
  ["2026-11-12", "the 12th"],
  ["2026-11-01", "the 1st"],
  ["2026-11-22", "the 22nd"],
  ["2026-11-13", "the 13th"],
  ["2027-01-31", "the 31st or the month's last day"],
])("payment day for %s is %s", (iso, label) => {
  expect(getPaymentDayLabel(day(iso))).toBe(label);
});
