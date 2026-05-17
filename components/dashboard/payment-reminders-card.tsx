"use client";

import { AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type PaymentReminder = {
  loanId: string;
  borrowerName: string;
  propertyAddress: string;
  amount: number;
  dueDate: string;
  daysUntilDue: number;
  status: "past_due" | "due_soon";
  source: "scheduled_charge" | "monthly_payment";
  type: string;
  chargeId?: string;
};

type PaymentReminderData = {
  reminders: PaymentReminder[];
  pastDueCount: number;
  dueSoonCount: number;
  totalAmountDue: number;
  windowDays: number;
};

interface PaymentRemindersCardProps {
  data: PaymentReminderData | undefined;
  title?: string;
  description?: string;
  showBorrower?: boolean;
  onLoanClick?: (loanId: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  monthly_payment: "Monthly payment",
  monthly_interest: "Monthly interest",
  prepaid_interest: "Prepaid interest",
  draw_proration: "Draw proration",
};

function statusLabel(status: PaymentReminder["status"]) {
  return status === "past_due" ? "Past Due" : "Due Soon";
}

function dueText(daysUntilDue: number) {
  if (daysUntilDue < 0) {
    const days = Math.abs(daysUntilDue);
    return `${days} day${days === 1 ? "" : "s"} past due`;
  }
  if (daysUntilDue === 0) return "Due today";
  return `Due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`;
}

export function PaymentRemindersCard({
  data,
  title = "Payment Reminders",
  description,
  showBorrower = true,
  onLoanClick,
}: PaymentRemindersCardProps) {
  const reminders = data?.reminders ?? [];
  const hasReminders = reminders.length > 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_12px_32px_rgba(0,0,0,0.04)]">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div
            className={cn(
              "mt-0.5 rounded-xl p-2",
              data && data.pastDueCount > 0
                ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300"
                : "bg-primary/10 text-primary"
            )}
          >
            {data && !hasReminders ? <CheckCircle2 className="size-5" /> : <CalendarClock className="size-5" />}
          </div>
          <div>
            <h3 className="text-base font-semibold text-balance">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {description ??
                (data
                  ? `Past due and next ${data.windowDays} days of expected payments.`
                  : "Loading payment reminders...")}
            </p>
          </div>
        </div>

        {data && (
          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-80">
            <div className="rounded-lg bg-red-50 px-3 py-2 text-red-700 dark:bg-red-950/30 dark:text-red-300">
              <p className="text-[11px] font-medium uppercase tracking-wide">Past Due</p>
              <p className="text-lg font-bold tabular-nums">{data.pastDueCount}</p>
            </div>
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              <p className="text-[11px] font-medium uppercase tracking-wide">Due Soon</p>
              <p className="text-lg font-bold tabular-nums">{data.dueSoonCount}</p>
            </div>
            <div className="rounded-lg bg-muted/60 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total Due</p>
              <p className="text-lg font-bold tabular-nums">{formatCurrency(data.totalAmountDue)}</p>
            </div>
          </div>
        )}
      </div>

      {!data ? (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
          Loading payment reminders...
        </div>
      ) : hasReminders ? (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border/60">
          {reminders.slice(0, 6).map((reminder) => (
            <button
              key={`${reminder.loanId}-${reminder.dueDate}-${reminder.type}-${reminder.chargeId ?? "monthly"}`}
              type="button"
              onClick={() => onLoanClick?.(reminder.loanId)}
              disabled={!onLoanClick}
              className={cn(
                "flex min-h-16 w-full flex-col gap-3 p-4 text-left transition-[background-color,scale] duration-150 sm:flex-row sm:items-center sm:justify-between",
                onLoanClick && "hover:bg-muted/40 active:scale-[0.96]"
              )}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                      reminder.status === "past_due"
                        ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                    )}
                  >
                    {statusLabel(reminder.status)}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {TYPE_LABELS[reminder.type] ?? reminder.type}
                  </span>
                </div>
                <p className="mt-2 truncate text-sm font-semibold">
                  {showBorrower ? `${reminder.borrowerName} - ` : ""}{reminder.propertyAddress}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {dueText(reminder.daysUntilDue)} on <span className="tabular-nums">{reminder.dueDate}</span>
                </p>
              </div>

              <div className="flex items-center gap-3 sm:shrink-0">
                {reminder.status === "past_due" && <AlertTriangle className="size-4 text-red-500" />}
                <span className="text-sm font-bold tabular-nums">{formatCurrency(reminder.amount)}</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
          No upcoming or past due payments need logging.
        </div>
      )}
    </div>
  );
}
