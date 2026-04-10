import { cn } from "@/lib/utils";
import { Check, X, AlertTriangle } from "lucide-react";

const STEPS = [
  { key: "submitted", label: "Submitted" },
  { key: "under_review", label: "Under Review" },
  { key: "approved", label: "Approved" },
  { key: "funded", label: "Funded" },
  { key: "sent_to_title", label: "Sent to Title" },
  { key: "closed", label: "Closed" },
] as const;

const STEP_ORDER: Record<string, number> = {
  submitted: 0,
  under_review: 1,
  approved: 2,
  funded: 3,
  sent_to_title: 4,
  closed: 5,
};

interface LoanStatusTimelineProps {
  status: string;
  className?: string;
}

export function LoanStatusTimeline({ status, className }: LoanStatusTimelineProps) {
  const isDenied = status === "denied";
  const isInfoNeeded = status === "additional_info_needed";
  const currentIndex = STEP_ORDER[status] ?? (isInfoNeeded ? 1 : -1);

  return (
    <div className={cn("w-full", className)}>
      {/* Special state banners */}
      {isDenied && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
          <X className="size-4" />
          This loan application has been denied
        </div>
      )}
      {isInfoNeeded && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
          <AlertTriangle className="size-4" />
          Additional information has been requested
        </div>
      )}

      {/* Timeline */}
      <div className="flex items-center">
        {STEPS.map((step, i) => {
          const isCompleted = !isDenied && currentIndex > i;
          const isCurrent = !isDenied && currentIndex === i;

          return (
            <div key={step.key} className="flex flex-1 items-center">
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
