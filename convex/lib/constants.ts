/** Maximum number of items allowed in a single bulk operation */
export const MAX_BULK_OPERATION_SIZE = 50;

/** Maximum file upload size in bytes (25 MB, decimal) */
export const MAX_FILE_SIZE_BYTES = 25 * 1000 * 1000;

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

/** Loan statuses before funds are out. */
export const PRE_FUNDING_LOAN_STATUSES = [
  "submitted",
  "under_review",
  "additional_info_needed",
  "approved",
] as const;

/** Loan statuses that are outstanding and active. */
export const ACTIVE_LOAN_STATUSES = ["funded", "sent_to_title"] as const;

/** Loan statuses that reached funding at any point. */
export const FUNDED_LOAN_STATUSES = ["funded", "sent_to_title", "closed"] as const;

/** Loan statuses that are still in the admin pipeline. */
export const PIPELINE_LOAN_STATUSES = [
  ...PRE_FUNDING_LOAN_STATUSES,
  ...ACTIVE_LOAN_STATUSES,
] as const;

export function isPreFundingLoanStatus(status: string) {
  return (PRE_FUNDING_LOAN_STATUSES as readonly string[]).includes(status);
}

export function isActiveLoanStatus(status: string) {
  return (ACTIVE_LOAN_STATUSES as readonly string[]).includes(status);
}

export function isFundedLoanStatus(status: string) {
  return (FUNDED_LOAN_STATUSES as readonly string[]).includes(status);
}

export function isPipelineLoanStatus(status: string) {
  return (PIPELINE_LOAN_STATUSES as readonly string[]).includes(status);
}

/** Loan statuses that can create draw requests while funds are still outstanding. */
export const DRAW_ELIGIBLE_LOAN_STATUSES = ["approved", "funded", "sent_to_title", "closed"] as const;

export function isDrawEligibleLoanStatus(status: string) {
  return (DRAW_ELIGIBLE_LOAN_STATUSES as readonly string[]).includes(status);
}

export function isDrawEligibleLoan(loan: { status: string; returnedDate?: string | null }) {
  return !loan.returnedDate && isDrawEligibleLoanStatus(loan.status);
}

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

/** Default loan calculation constants */
export const DEFAULT_INTEREST_RATE = 13;
export const DEFAULT_POINTS_PERCENTAGE = 3;
export const DEFAULT_PAYMENT_DUE_DAY = 1;

/** Strategy labels for display */
export const STRATEGY_LABELS: Record<string, string> = {
  flip_and_resell: "Fix & Flip",
  brrrr: "BRRRR Strategy",
};

/** Payment type labels for display */
export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  balloon: "Balloon (Interest Due at Payoff)",
  monthly: "Monthly Interest Payments",
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
  "loan.returned": "Recorded Funds Returned",
  "loan.bulkStatus": "Bulk Updated Loan Status",
  "loan.delete": "Deleted Loan",
  "loan.attachClosing": "Attached Closing Statement",
  "loan.removeClosing": "Removed Closing Statement",
  "draw.review": "Reviewed Draw Request",
  "draw.bulkReview": "Bulk Reviewed Draw Requests",
  "draw.submit": "Submitted Draw Request",
  "draw.manualCreate": "Created Manual Draw Request",
  "draw.update": "Updated Draw Request",
  "user.createBorrower": "Created Borrower",
  "user.createInvestor": "Created Investor",
  "user.toggleActive": "Toggled User Active",
  "user.bulkToggleActive": "Bulk Toggled Users Active",
  "user.updateProfile": "Updated User Profile",
  "settings.updateDefaultInterestRate": "Updated Default Interest Rate",
  "investment.create": "Created Investment",
  "investment.update": "Updated Investment",
  "investment.delete": "Deleted Investment",
  "rehab.addItem": "Added Rehab Budget Item",
  "rehab.updateItem": "Updated Rehab Budget Item",
  "rehab.deleteItem": "Deleted Rehab Budget Item",
  "payment.record": "Recorded Payment",
  "payment.delete": "Deleted Payment",
  "payment.bulkDelete": "Bulk Deleted Payments",
  "charge.remove": "Removed Charge",
  "document.delete": "Deleted Document",
  "comps.fetch": "Fetched Property Comps",
  "user.create": "Created User",
  "user.changeRole": "Changed User Role",
  "application.submit": "Submitted Loan Application",
  "user.updateOwnProfile": "Updated Own Profile",
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

/** Document type labels for display */
export const DOC_TYPE_LABELS: Record<string, string> = {
  articles: "Articles of Organization",
  operating_agreement: "Operating Agreement",
  closing_statement: "Closing Statement",
  wire_instructions: "Wire Instructions",
  property_photo: "Property Photo",
  receipt: "Receipt",
  lien_waiver: "Lien Waiver",
  rehab_budget: "Rehab Budget",
  other: "Other",
};

/** Format currency for use in notification bodies (server-side, no browser APIs) */
export function formatCurrencyPlain(value: number): string {
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
