const PENDING_LOAN_STATUSES = [
  "submitted",
  "under_review",
  "additional_info_needed",
  "approved",
  "funded",
  "sent_to_title",
] as const;

const LOAN_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  funds_returned: "Funds Returned",
  submitted: "Submitted",
  under_review: "Under Review",
  additional_info_needed: "Info Needed",
  approved: "Approved",
  denied: "Denied",
  funded: "Funded",
  sent_to_title: "Sent to Title",
  closed: "Closed",
};

type LoanDisplayInput = {
  status: string;
  returnedDate?: string;
};

export function isFundsReturnedLoan(loan: LoanDisplayInput) {
  return Boolean(loan.returnedDate);
}

export function isPendingLoanDisplay(loan: LoanDisplayInput) {
  return !loan.returnedDate && PENDING_LOAN_STATUSES.includes(loan.status as (typeof PENDING_LOAN_STATUSES)[number]);
}

export function isClosedLoanDisplay(loan: LoanDisplayInput) {
  return loan.status === "closed" && !loan.returnedDate;
}

export function isDeniedLoanDisplay(loan: LoanDisplayInput) {
  return loan.status === "denied" && !loan.returnedDate;
}

export function getLoanDisplayStatus(loan: LoanDisplayInput) {
  if (isFundsReturnedLoan(loan)) return "funds_returned";
  if (isClosedLoanDisplay(loan)) return "closed";
  if (isPendingLoanDisplay(loan)) return "pending";
  return loan.status;
}

export function getLoanStatusLabel(status: string) {
  return LOAN_STATUS_LABELS[status] ?? status;
}

export function getLoanDisplayStatusLabel(loan: LoanDisplayInput) {
  return getLoanStatusLabel(getLoanDisplayStatus(loan));
}
