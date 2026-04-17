import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; className: string; dot: string }> = {
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
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}
