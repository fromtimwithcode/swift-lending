export const DELETE_REASON_MAX_LENGTH = 2000;

const PAYMENT_REMINDER_TYPE_LABELS: Record<string, string> = {
  monthly_payment: "Monthly payment",
  monthly_interest: "Monthly interest",
  prepaid_interest: "Prepaid interest",
  draw_proration: "Draw proration",
};

export function getPaymentReminderTypeLabel(type: string) {
  return type
    .split("+")
    .map((part) => PAYMENT_REMINDER_TYPE_LABELS[part] ?? part)
    .join(" + ");
}

export function getDeleteReasonError(reason: string) {
  const length = reason.trim().length;
  if (length === 0) return "Explain why this is being deleted.";
  if (length > DELETE_REASON_MAX_LENGTH) {
    return `Keep the reason to ${DELETE_REASON_MAX_LENGTH.toLocaleString("en-US")} characters or fewer.`;
  }
  return null;
}
