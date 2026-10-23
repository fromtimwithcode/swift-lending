import { cn } from "@/lib/utils";
import { Check, X, AlertTriangle, Ban, type LucideIcon } from "lucide-react";
import {
  isLoanProgressStatus,
  type LoanProgressStatus,
  type LoanStatus,
} from "@/convex/lib/loanStatus";

const STEPS = [
  { key: "submitted", label: "Submitted" },
  { key: "under_review", label: "Under Review" },
  { key: "approved", label: "Approved" },
  { key: "funded", label: "Funded" },
  { key: "sent_to_title", label: "Sent to Title" },
  { key: "closed", label: "Closed" },
] as const satisfies readonly { key: LoanProgressStatus; label: string }[];

const BANNERS: Partial<Record<LoanStatus, { icon: LucideIcon; text: string; className: string }>> = {
  denied: {
    icon: X,
    text: "This loan application has been denied",
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  canceled: {
    icon: Ban,
    text: "This loan application was canceled",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
  },
  additional_info_needed: {
    icon: AlertTriangle,
    text: "Additional information has been requested",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
};

interface LoanStatusTimelineProps {
  status: LoanStatus;
  progressStatus?: LoanProgressStatus;
  className?: string;
}

export function LoanStatusTimeline({ status, progressStatus, className }: LoanStatusTimelineProps) {
  const ended = status === "denied" || status === "canceled";
  const progress = isLoanProgressStatus(status)
    ? status
    : progressStatus ?? (status === "additional_info_needed" ? "under_review" : undefined);
  const currentIndex = STEPS.findIndex((step) => step.key === progress);
  const banner = BANNERS[status];

  return (
    <div className={cn("w-full", className)}>
      {banner && (
        <div className={cn("mb-4 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium", banner.className)}>
          <banner.icon className="size-4" />
          {banner.text}
        </div>
      )}

      {/* Timeline */}
      <div className="flex items-center">
        {STEPS.map((step, i) => {
          const isCompleted = !ended && currentIndex > i;
          const isCurrent = !ended && currentIndex === i;

          return (
            <div key={step.key} aria-current={isCurrent ? "step" : undefined} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                    isCompleted
                      ? "border-primary bg-primary text-primary-foreground"
                      : isCurrent
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted-foreground/30 text-muted-foreground/50"
                  )}
                >
                  {isCompleted ? <Check className="size-4" /> : i + 1}
                </div>
                <span
                  className={cn(
                    "mt-2 text-[10px] sm:text-xs font-medium text-center max-w-[60px] sm:max-w-none leading-tight",
                    isCurrent
                      ? "text-primary"
                      : isCompleted
                        ? "text-foreground"
                        : "text-muted-foreground/50"
                  )}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-1 h-0.5 flex-1 sm:mx-2",
                    isCompleted ? "bg-primary" : "bg-muted-foreground/20"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
