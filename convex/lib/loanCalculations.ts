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
