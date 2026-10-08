import { LOAN_STATUS_LABELS } from "./constants";

export const LOAN_STATUSES = [
  "submitted",
  "under_review",
  "additional_info_needed",
  "approved",
  "denied",
  "funded",
  "sent_to_title",
  "closed",
] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];
export const STATUS_NOTE_MAX_LENGTH = 2000;

export const LOAN_PROGRESS_STATUSES = [
  "submitted",
  "under_review",
  "approved",
  "funded",
  "sent_to_title",
  "closed",
] as const;
export type LoanProgressStatus = (typeof LOAN_PROGRESS_STATUSES)[number];

export function isLoanProgressStatus(status: LoanStatus): status is LoanProgressStatus {
  return (LOAN_PROGRESS_STATUSES as readonly LoanStatus[]).includes(status);
}

/** The timeline step a loan was on when it moved to Info Needed or Denied. */
export function getProgressStatusAfterChange(
  loan: { status: LoanStatus; progressStatus?: LoanProgressStatus },
  next: LoanStatus,
): LoanProgressStatus | undefined {
  if (isLoanProgressStatus(next)) return undefined;
  return isLoanProgressStatus(loan.status) ? loan.status : loan.progressStatus;
}

export function getNextLoanStatuses(status: LoanStatus): readonly LoanStatus[] {
  return status === "closed"
    ? []
    : LOAN_STATUSES.filter((next) => next !== status);
}

export function requiresStatusNote(status: LoanStatus) {
  return status === "additional_info_needed" || status === "denied";
}

export function getStatusNoteError(
  status: LoanStatus,
  note: string | undefined,
) {
  if (requiresStatusNote(status) && !note?.trim()) {
    return status === "denied"
      ? "Enter a reason for denying this loan."
      : "Describe the information still needed.";
  }
  if ((note?.trim().length ?? 0) > STATUS_NOTE_MAX_LENGTH) {
    return `Keep the explanation to ${STATUS_NOTE_MAX_LENGTH.toLocaleString("en-US")} characters or fewer.`;
  }
  return null;
}

export function getLoanStatusChangeError(
  loan: { status: LoanStatus; returnedDate?: string },
  next: LoanStatus,
  expectedStatus?: LoanStatus,
) {
  if (loan.returnedDate && next !== "closed") {
    return "Cannot change status after funds have been marked returned.";
  }
  // Repeated requests are harmless and must not send duplicate notifications.
  if (loan.status === next) return null;
  if (expectedStatus !== undefined && loan.status !== expectedStatus) {
    return `The status changed to ${LOAN_STATUS_LABELS[loan.status]} while you were reviewing. Close this dialog and review the latest status.`;
  }
  if (!getNextLoanStatuses(loan.status).includes(next)) {
    return `Cannot move from ${LOAN_STATUS_LABELS[loan.status]} to ${LOAN_STATUS_LABELS[next]}.`;
  }
  return null;
}
