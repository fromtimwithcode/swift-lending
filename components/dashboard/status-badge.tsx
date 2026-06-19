import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; className: string; dot: string }> = {
  active: {
    label: "Active",
    className: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/10 dark:bg-sky-900/30 dark:text-sky-300 dark:ring-sky-400/10",
    dot: "bg-sky-500",
  },
  funds_returned: {
    label: "Funds Returned",
    className: "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-600/10 dark:bg-teal-900/30 dark:text-teal-300 dark:ring-teal-400/10",
    dot: "bg-teal-500",
  },
  pending: {
    label: "Pending",
    className: "bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/10 dark:bg-yellow-900/30 dark:text-yellow-300 dark:ring-yellow-400/10",
    dot: "bg-yellow-500",
  },
  submitted: {
    label: "Submitted",
    className: "bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/10 dark:bg-gray-800/60 dark:text-gray-300 dark:ring-gray-400/10",
    dot: "bg-gray-500",
  },
  under_review: {
    label: "Under Review",
    className: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/10 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-400/10",
    dot: "bg-blue-500",
  },
  additional_info_needed: {
    label: "Info Needed",
    className: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/10 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-400/10",
    dot: "bg-amber-500",
  },
  approved: {
    label: "Approved",
    className: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/10 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-400/10",
    dot: "bg-green-500",
  },
  denied: {
    label: "Denied",
    className: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-400/10",
    dot: "bg-red-500",
  },
  funded: {
    label: "Funded",
    className: "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/10 dark:bg-purple-900/30 dark:text-purple-300 dark:ring-purple-400/10",
    dot: "bg-purple-500",
  },
  sent_to_title: {
    label: "Sent to Title",
    className: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/10 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-400/10",
    dot: "bg-indigo-500",
  },
  closed: {
    label: "Closed",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-400/10",
    dot: "bg-emerald-500",
  },
  on_time: {
    label: "On Time",
    className: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/10 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-400/10",
    dot: "bg-green-500",
  },
  late: {
    label: "Late",
    className: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/10 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-400/10",
    dot: "bg-amber-500",
  },
  partial: {
    label: "Partial",
    className: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/10 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-400/10",
    dot: "bg-blue-500",
  },
  missed: {
    label: "Missed",
    className: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-400/10",
    dot: "bg-red-500",
  },
  ach: {
    label: "ACH",
    className: "bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/10 dark:bg-gray-800/60 dark:text-gray-300 dark:ring-gray-400/10",
    dot: "bg-gray-500",
  },
  wire: {
    label: "Wire",
    className: "bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/10 dark:bg-gray-800/60 dark:text-gray-300 dark:ring-gray-400/10",
    dot: "bg-gray-500",
  },
  check: {
    label: "Check",
    className: "bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/10 dark:bg-gray-800/60 dark:text-gray-300 dark:ring-gray-400/10",
    dot: "bg-gray-500",
  },
  other: {
    label: "Other",
    className: "bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/10 dark:bg-gray-800/60 dark:text-gray-300 dark:ring-gray-400/10",
    dot: "bg-gray-500",
  },
  articles: {
    label: "Articles of Organization",
    className: "bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/10 dark:bg-gray-800/60 dark:text-gray-300 dark:ring-gray-400/10",
    dot: "bg-gray-500",
  },
  operating_agreement: {
    label: "Operating Agreement",
    className: "bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/10 dark:bg-gray-800/60 dark:text-gray-300 dark:ring-gray-400/10",
    dot: "bg-gray-500",
  },
  property_photo: {
    label: "Property Photo",
    className: "bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/10 dark:bg-gray-800/60 dark:text-gray-300 dark:ring-gray-400/10",
    dot: "bg-gray-500",
  },
  closing_statement: {
    label: "Closing Statement",
    className: "bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/10 dark:bg-gray-800/60 dark:text-gray-300 dark:ring-gray-400/10",
    dot: "bg-gray-500",
  },
  wire_instructions: {
    label: "Wire Instructions",
    className: "bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/10 dark:bg-gray-800/60 dark:text-gray-300 dark:ring-gray-400/10",
    dot: "bg-gray-500",
  },
  receipt: {
    label: "Receipt",
    className: "bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/10 dark:bg-gray-800/60 dark:text-gray-300 dark:ring-gray-400/10",
    dot: "bg-gray-500",
  },
  lien_waiver: {
    label: "Lien Waiver",
    className: "bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/10 dark:bg-gray-800/60 dark:text-gray-300 dark:ring-gray-400/10",
    dot: "bg-gray-500",
  },
  rehab_budget: {
    label: "Rehab Budget",
    className: "bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/10 dark:bg-gray-800/60 dark:text-gray-300 dark:ring-gray-400/10",
    dot: "bg-gray-500",
  },
  prepaid_interest: {
    label: "Prepaid Interest",
    className: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/10 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-400/10",
    dot: "bg-blue-500",
  },
  monthly_interest: {
    label: "Monthly Interest",
    className: "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/10 dark:bg-purple-900/30 dark:text-purple-300 dark:ring-purple-400/10",
    dot: "bg-purple-500",
  },
  draw_proration: {
    label: "Draw Proration",
    className: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/10 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-400/10",
    dot: "bg-amber-500",
  },
  scheduled: {
    label: "Scheduled",
    className: "bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/10 dark:bg-gray-800/60 dark:text-gray-300 dark:ring-gray-400/10",
    dot: "bg-gray-500",
  },
  paid: {
    label: "Paid",
    className: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/10 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-400/10",
    dot: "bg-green-500",
  },
  waived: {
    label: "Waived",
    className: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-400/10",
    dot: "bg-red-500",
  },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    className: "bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/10",
    dot: "bg-gray-500",
  };

  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex w-fit max-w-full flex-nowrap items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium leading-4 [overflow-wrap:normal]",
        config.className,
        className
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", config.dot)} />
      <span className="min-w-0 truncate whitespace-nowrap [overflow-wrap:normal]">
        {config.label}
      </span>
    </span>
  );
}
