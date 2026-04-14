/** Maximum number of items allowed in a single bulk operation */
export const MAX_BULK_OPERATION_SIZE = 50;

/** Loan status labels for display */
export const LOAN_STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  additional_info_needed: "Additional Info Needed",
  approved: "Approved",
  denied: "Denied",
  funded: "Funded",
  sent_to_title: "Sent to Title",
  closed: "Closed",
};

/** Draw request status labels for display */
export const DRAW_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  under_review: "Under Review",
  approved: "Approved",
  denied: "Denied",
};

/** Rehab budget categories */
export const REHAB_CATEGORIES = [
  { value: "demo", label: "Demo" },
  { value: "exterior", label: "Exterior" },
  { value: "interior", label: "Interior" },
  { value: "dumpster", label: "Dumpster" },
  { value: "miscellaneous", label: "Miscellaneous" },
  { value: "overage", label: "Overage" },
] as const;

/** Payment status labels for display */
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  on_time: "On Time",
  late: "Late",
  partial: "Partial",
  missed: "Missed",
};

/** Payment method labels for display */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  ach: "ACH",
  wire: "Wire",
  check: "Check",
  other: "Other",
};

/** Role labels for display */
export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  developer: "Developer",
  borrower: "Borrower",
  investor: "Investor",
};

/** Activity log action labels for display */
export const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  "loan.create": "Created Loan",
  "loan.update": "Updated Loan",
  "loan.status": "Changed Loan Status",
  "loan.bulkStatus": "Bulk Updated Loan Status",
  "loan.attachClosing": "Attached Closing Statement",
  "loan.removeClosing": "Removed Closing Statement",
  "draw.review": "Reviewed Draw Request",
  "draw.bulkReview": "Bulk Reviewed Draw Requests",
  "draw.submit": "Submitted Draw Request",
  "user.createBorrower": "Created Borrower",
  "user.createInvestor": "Created Investor",
  "user.toggleActive": "Toggled User Active",
  "user.bulkToggleActive": "Bulk Toggled Users Active",
  "user.updateProfile": "Updated User Profile",
  "investment.create": "Created Investment",
  "investment.update": "Updated Investment",
  "investment.delete": "Deleted Investment",
  "rehab.addItem": "Added Rehab Budget Item",
  "rehab.updateItem": "Updated Rehab Budget Item",
  "rehab.deleteItem": "Deleted Rehab Budget Item",
  "payment.record": "Recorded Payment",
  "payment.delete": "Deleted Payment",
  "payment.bulkDelete": "Bulk Deleted Payments",
  "document.delete": "Deleted Document",
  "comps.fetch": "Fetched Property Comps",
  "user.create": "Created User",
  "user.changeRole": "Changed User Role",
  "application.submit": "Submitted Loan Application",
};

/** Entity type labels for display */
export const ENTITY_TYPE_LABELS: Record<string, string> = {
  loan: "Loan",
  draw: "Draw",
  user: "User",
  investment: "Investment",
  payment: "Payment",
  document: "Document",
  message: "Message",
  system: "System",
};

/** Format currency for use in notification bodies (server-side, no browser APIs) */
export function formatCurrencyPlain(value: number): string {
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
