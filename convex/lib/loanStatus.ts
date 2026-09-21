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

export const LOAN_STATUS_TRANSITIONS: Record<
  LoanStatus,
  readonly LoanStatus[]
> = {
  submitted: ["under_review", "additional_info_needed", "denied", "closed"],
  under_review: ["approved", "additional_info_needed", "denied", "closed"],
  additional_info_needed: ["under_review", "approved", "denied", "closed"],
  approved: ["funded", "denied", "closed"],
  funded: ["sent_to_title", "closed"],
  sent_to_title: ["closed"],
  denied: ["under_review", "approved", "closed"],
  closed: [],
};

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
  if (!LOAN_STATUS_TRANSITIONS[loan.status].includes(next)) {
    return `Cannot move from ${LOAN_STATUS_LABELS[loan.status]} to ${LOAN_STATUS_LABELS[next]}.`;
  }
  return null;
}
