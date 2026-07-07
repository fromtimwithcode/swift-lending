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

export function roundCents(value: number) {
  return Math.round(value * 100) / 100;
}

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
  return roundCents((principalOut * annualRate) / 100 / 12);
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

export function getFirstMonthlyInterestPeriod(closeDate: string) {
  const close = parseUsDate(closeDate);
  if (!close) return null;

  const periodStart = new Date(close.getFullYear(), close.getMonth() + 1, 1);
  const periodEnd = getMonthEnd(periodStart);
  const dueDate = new Date(close.getFullYear(), close.getMonth() + 2, 1);

  return {
    periodStart: formatUsDate(periodStart),
    periodEnd: formatUsDate(periodEnd),
    dueDate: formatUsDate(dueDate),
  };
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
  const paymentDueDay = args.paymentDueDay ?? 1;
  const maxPeriods = args.maxPeriods ?? 120;
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
  const paymentDueDay = args.paymentDueDay ?? 1;
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
}) {
  const wire = parseUsDate(args.wireDate);
  if (!wire) return null;

  const daysInMonth = getDaysInMonth(wire);
  const daysCharged = daysInMonth - wire.getDate() + 1;
  const perDiem = calculateMonthlyPerDiem(args.drawAmount, args.annualRate, wire);
  const periodEnd = getMonthEnd(wire);
  const dueDate = new Date(wire.getFullYear(), wire.getMonth() + 1, 1);

  return {
    amount: roundCents(perDiem * daysCharged),
    perDiem,
    daysCharged,
    periodStart: formatUsDate(wire),
    periodEnd: formatUsDate(periodEnd),
    dueDate: formatUsDate(dueDate),
  };
}
