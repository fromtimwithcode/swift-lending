import { getBusinessDate } from "./dates";
import { MONTHS_PER_YEAR, PERCENTAGE_DIVISOR, roundCents } from "./financialRules";

const MS_PER_DAY = 86_400_000;
const DAYS_PER_INTEREST_MONTH = 30;
const MAX_SCHEDULED_PAYMENTS = 600;

/**
 * Investment dates are calendar days stored as the timestamp of their UTC
 * midnight, so they must be read and formatted in UTC.
 */
export type CalendarDay = number;

export type InvestmentTerms = {
  investmentAmount: number;
  interestRate: number;
  inceptionDate: CalendarDay;
  firstPaymentDate: CalendarDay;
  priorPaymentsReceived: number;
};

export type InvestmentSummary = {
  monthlyPayment: number;
  annualInterest: number;
  interestEarned: number;
  paidToDate: number;
  unpaidInterest: number;
  pastDue: { amount: number; since: CalendarDay } | null;
  nextPayment: { amount: number; dueDate: CalendarDay } | null;
};

export function isCalendarDay(value: number) {
  return Number.isSafeInteger(value) && value % MS_PER_DAY === 0;
}

export function toCalendarDay(timestamp: number): CalendarDay {
  return Math.floor(timestamp / MS_PER_DAY) * MS_PER_DAY;
}

export function parseIsoCalendarDay(value: string): CalendarDay | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const result = Date.UTC(year, month - 1, day);
  const date = new Date(result);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? result
    : null;
}

export function toIsoCalendarDay(day: CalendarDay) {
  return new Date(day).toISOString().slice(0, 10);
}

export function formatCalendarDay(day: CalendarDay) {
  const date = new Date(day);
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCDate()).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

export function getBusinessCalendarDay(now = new Date()): CalendarDay {
  const date = getBusinessDate(now);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addCalendarMonths(day: CalendarDay, months: number): CalendarDay {
  const date = new Date(day);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay));
}

function getWholeMonthsBetween(start: CalendarDay, end: CalendarDay) {
  const from = new Date(start);
  const to = new Date(end);
  const months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * MONTHS_PER_YEAR +
    to.getUTCMonth() -
    from.getUTCMonth();
  return addCalendarMonths(start, months) > end ? months - 1 : months;
}

/** Whole months, plus each leftover day counted as 1/30 of a month. */
function getInterestMonths(start: CalendarDay, end: CalendarDay) {
  const months = getWholeMonthsBetween(start, end);
  const days = (end - addCalendarMonths(start, months)) / MS_PER_DAY;
  return months + Math.min(days, DAYS_PER_INTEREST_MONTH) / DAYS_PER_INTEREST_MONTH;
}

function getMonthlyInterest(terms: InvestmentTerms) {
  return (terms.investmentAmount * terms.interestRate) / PERCENTAGE_DIVISOR / MONTHS_PER_YEAR;
}

function* getScheduledPayments(terms: InvestmentTerms) {
  const monthlyInterest = getMonthlyInterest(terms);
  for (let index = 0; index < MAX_SCHEDULED_PAYMENTS; index++) {
    yield {
      periodStart:
        index === 0
          ? terms.inceptionDate
          : addCalendarMonths(terms.firstPaymentDate, index - 1),
      dueDate: addCalendarMonths(terms.firstPaymentDate, index),
      amount: roundCents(
        monthlyInterest *
          (index === 0 ? getInterestMonths(terms.inceptionDate, terms.firstPaymentDate) : 1)
      ),
    };
  }
}

/**
 * Interest is paid monthly on the first payment date's day of the month. The
 * first payment covers inception through the first payment date. Payments
 * received cover the oldest scheduled payment first.
 */
export function summarizeInvestment(
  terms: InvestmentTerms,
  payoutAmounts: number[],
  today: CalendarDay
): InvestmentSummary {
  const paidToDate = roundCents(
    payoutAmounts.reduce((sum, amount) => sum + amount, terms.priorPaymentsReceived)
  );
  let credit = paidToDate;
  let interestEarned = 0;
  let pastDueAmount = 0;
  let pastDueSince: CalendarDay | null = null;
  let nextPayment: InvestmentSummary["nextPayment"] = null;

  const monthlyPayment = roundCents(getMonthlyInterest(terms));
  if (monthlyPayment > 0) {
    for (const payment of getScheduledPayments(terms)) {
      if (payment.dueDate <= today) {
        interestEarned += payment.amount;
      } else if (payment.periodStart < today) {
        interestEarned +=
          (payment.amount * (today - payment.periodStart)) /
          (payment.dueDate - payment.periodStart);
      }
      const covered = Math.min(credit, payment.amount);
      credit = roundCents(credit - covered);
      const owed = roundCents(payment.amount - covered);
      if (owed <= 0) continue;
      if (payment.dueDate >= today) {
        nextPayment = { amount: owed, dueDate: payment.dueDate };
        break;
      }
      pastDueAmount = roundCents(pastDueAmount + owed);
      pastDueSince ??= payment.dueDate;
    }
  }

  interestEarned = roundCents(interestEarned);
  return {
    monthlyPayment,
    annualInterest: roundCents(getMonthlyInterest(terms) * MONTHS_PER_YEAR),
    interestEarned,
    paidToDate,
    unpaidInterest: roundCents(Math.max(0, interestEarned - paidToDate)),
    pastDue: pastDueSince === null ? null : { amount: pastDueAmount, since: pastDueSince },
    nextPayment,
  };
}

export function getDefaultFirstPaymentDate(inceptionDate: CalendarDay) {
  return addCalendarMonths(inceptionDate, 1);
}

export type InvestmentTermsError = { field: keyof InvestmentTerms; message: string };

export function getInvestmentTermsError(terms: InvestmentTerms): InvestmentTermsError | null {
  if (!(terms.investmentAmount > 0) || !Number.isFinite(terms.investmentAmount))
    return { field: "investmentAmount", message: "Enter an investment amount greater than $0." };
  if (!(terms.interestRate >= 0 && terms.interestRate <= PERCENTAGE_DIVISOR))
    return { field: "interestRate", message: "Enter an annual rate from 0% to 100%." };
  if (!isCalendarDay(terms.inceptionDate))
    return { field: "inceptionDate", message: "Choose an inception date." };
  if (!isCalendarDay(terms.firstPaymentDate))
    return { field: "firstPaymentDate", message: "Choose a first payment date." };
  if (terms.firstPaymentDate <= terms.inceptionDate)
    return {
      field: "firstPaymentDate",
      message: "The first payment date must be after the inception date.",
    };
  if (!(terms.priorPaymentsReceived >= 0) || !Number.isFinite(terms.priorPaymentsReceived))
    return {
      field: "priorPaymentsReceived",
      message: "Payments received before tracking can't be negative.",
    };
  return null;
}

export type PayoutError = { field: "amount" | "paidDate"; message: string };

export function getPayoutError(
  payout: { amount: number; paidDate: CalendarDay },
  terms: { inceptionDate: CalendarDay },
  today: CalendarDay
): PayoutError | null {
  if (!(payout.amount > 0) || !Number.isFinite(payout.amount))
    return { field: "amount", message: "Enter a payment amount greater than $0." };
  if (!isCalendarDay(payout.paidDate))
    return { field: "paidDate", message: "Choose the payment date." };
  if (payout.paidDate > today)
    return { field: "paidDate", message: "The payment date can't be in the future." };
  if (payout.paidDate < terms.inceptionDate)
    return { field: "paidDate", message: "The payment date can't be before the inception date." };
  return null;
}

function ordinal(value: number) {
  const suffix =
    value % 100 >= 11 && value % 100 <= 13
      ? "th"
      : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[value % 10] ?? "th";
  return `${value}${suffix}`;
}

export function getPaymentDayLabel(firstPaymentDate: CalendarDay) {
  const day = new Date(firstPaymentDate).getUTCDate();
  return day > 28 ? `the ${ordinal(day)} or the month's last day` : `the ${ordinal(day)}`;
}
