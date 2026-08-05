import {
  MAX_MONTHLY_INTEREST_PERIODS,
  MONTHS_PER_YEAR,
  PERCENTAGE_DIVISOR,
  roundCents,
} from "./financialRules";
import {
  DEFAULT_PAYMENT_DUE_DAY,
  DEFAULT_POINTS_PERCENTAGE,
} from "./constants";

function parseUsDate(value: string): Date | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

function getDueDate(year: number, monthIndex: number, paymentDueDay: number) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(paymentDueDay, lastDay));
}

export { roundCents } from "./financialRules";

export function formatUsDate(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
}

export function getCurrentPrincipalOut(args: {
  loanAmount: number;
  drawFundsTotal?: number;
  drawFundsUsed?: number;
}) {
  const principal = args.loanAmount - (args.drawFundsTotal ?? 0) + (args.drawFundsUsed ?? 0);
  return Math.max(0, Math.min(args.loanAmount, roundCents(principal)));
}

export function calculateMonthlyInterest(principalOut: number, annualRate: number) {
  if (principalOut <= 0 || annualRate <= 0) return 0;
  return roundCents(
    (principalOut * annualRate) / PERCENTAGE_DIVISOR / MONTHS_PER_YEAR
  );
}

export function calculatePoints(loanAmount: number, pointsPercentage: number) {
  if (loanAmount <= 0 || pointsPercentage <= 0) return 0;
  return roundCents((loanAmount * pointsPercentage) / PERCENTAGE_DIVISOR);
}

export function getEffectivePointsPercentage(args: {
  loanAmount: number;
  pointsEarned: number;
  fallback?: number;
}) {
  if (
    !Number.isFinite(args.loanAmount) ||
    args.loanAmount <= 0 ||
    !Number.isFinite(args.pointsEarned) ||
    args.pointsEarned < 0
  ) {
    return args.fallback ?? DEFAULT_POINTS_PERCENTAGE;
  }

  return (args.pointsEarned / args.loanAmount) * PERCENTAGE_DIVISOR;
}

export function calculateMonthlyPaymentDue(args: {
  principalOut: number;
  annualRate: number;
  paymentType?: "balloon" | "monthly";
}) {
  if ((args.paymentType ?? "monthly") === "balloon") return 0;
  return calculateMonthlyInterest(args.principalOut, args.annualRate);
}

export function getDaysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function calculateMonthlyPerDiem(principalOut: number, annualRate: number, date: Date) {
  return roundCents(calculateMonthlyInterest(principalOut, annualRate) / getDaysInMonth(date));
}

export function getMonthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function getMonthlyInterestPeriods(args: {
  closeDate: string;
  windowEnd: Date;
  maturityDate?: string;
  paymentDueDay?: number;
  maxPeriods?: number;
}) {
  const close = parseUsDate(args.closeDate);
  if (!close) return [];

  const maturity = args.maturityDate ? parseUsDate(args.maturityDate) : null;
  const effectiveEnd = maturity && maturity < args.windowEnd ? maturity : args.windowEnd;
  const paymentDueDay = args.paymentDueDay ?? DEFAULT_PAYMENT_DUE_DAY;
  const maxPeriods = args.maxPeriods ?? MAX_MONTHLY_INTEREST_PERIODS;
  const periods: Array<{
    periodStart: string;
    periodEnd: string;
    dueDate: string;
    periodStartDate: Date;
  }> = [];

  for (
    let periodStart = new Date(close.getFullYear(), close.getMonth() + 1, 1), count = 0;
    count < maxPeriods;
    periodStart = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 1), count++
  ) {
    const periodEnd = getMonthEnd(periodStart);
    const dueDate = getDueDate(periodStart.getFullYear(), periodStart.getMonth() + 1, paymentDueDay);
    if (dueDate > effectiveEnd) break;

    periods.push({
      periodStart: formatUsDate(periodStart),
      periodEnd: formatUsDate(periodEnd),
      dueDate: formatUsDate(dueDate),
      periodStartDate: periodStart,
    });
  }

  return periods;
}

export function getMonthlyInterestPeriodForDate(args: {
  date: Date;
  paymentDueDay?: number;
}) {
  const paymentDueDay = args.paymentDueDay ?? DEFAULT_PAYMENT_DUE_DAY;
  const periodStart = new Date(args.date.getFullYear(), args.date.getMonth(), 1);
  const periodEnd = getMonthEnd(periodStart);
  const dueDate = getDueDate(periodStart.getFullYear(), periodStart.getMonth() + 1, paymentDueDay);

  return {
    periodStart: formatUsDate(periodStart),
    periodEnd: formatUsDate(periodEnd),
    dueDate: formatUsDate(dueDate),
    periodStartDate: periodStart,
  };
}

export function calculatePrepaidInterest(args: {
  principalOut: number;
  annualRate: number;
  closeDate: string;
}) {
  const close = parseUsDate(args.closeDate);
  if (!close) return null;

  const daysInMonth = getDaysInMonth(close);
  const daysCharged = daysInMonth - close.getDate() + 1;
  const perDiem = calculateMonthlyPerDiem(args.principalOut, args.annualRate, close);
  const periodEnd = getMonthEnd(close);

  return {
    amount: roundCents(perDiem * daysCharged),
    perDiem,
    daysCharged,
    periodStart: formatUsDate(close),
    periodEnd: formatUsDate(periodEnd),
    dueDate: formatUsDate(close),
  };
}

export function calculateDrawProration(args: {
  drawAmount: number;
  annualRate: number;
  wireDate: string;
  paymentDueDay?: number;
}) {
  const wire = parseUsDate(args.wireDate);
  if (!wire) return null;

  const daysInMonth = getDaysInMonth(wire);
  const daysCharged = daysInMonth - wire.getDate() + 1;
  const perDiem = calculateMonthlyPerDiem(args.drawAmount, args.annualRate, wire);
  const periodEnd = getMonthEnd(wire);
  const dueDate = getDueDate(
    wire.getFullYear(),
    wire.getMonth() + 1,
    args.paymentDueDay ?? DEFAULT_PAYMENT_DUE_DAY
  );

  return {
    amount: roundCents(perDiem * daysCharged),
    perDiem,
    daysCharged,
    periodStart: formatUsDate(wire),
    periodEnd: formatUsDate(periodEnd),
    dueDate: formatUsDate(dueDate),
  };
}
