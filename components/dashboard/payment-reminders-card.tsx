"use client";

import { AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ContextTooltip } from "@/components/dashboard/context-tooltip";
import { FINANCIAL_CONTEXT } from "@/lib/financial-context";

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

function typeLabel(type: string) {
  return type
    .split("+")
    .map((part) => TYPE_LABELS[part] ?? part)
    .join(" + ");
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
  const [activeFilter, setActiveFilter] = useState<PaymentReminder["status"] | null>(null);
  const reminders = data?.reminders ?? [];
  const filteredReminders = activeFilter
    ? reminders.filter((reminder) => reminder.status === activeFilter)
    : reminders;
  const visibleReminders = activeFilter ? filteredReminders : reminders.slice(0, 6);
  const hasReminders = reminders.length > 0;

  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_12px_32px_rgba(0,0,0,0.04)] sm:p-6">
      <div className="mb-4 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl",
              data && data.pastDueCount > 0
                ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300"
                : "bg-primary/10 text-primary"
            )}
          >
            {data && !hasReminders ? <CheckCircle2 className="size-5" /> : <CalendarClock className="size-5" />}
          </div>
          <div className="min-w-0">
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
          <div className="grid w-full grid-cols-1 gap-2 text-center min-[420px]:grid-cols-3 sm:w-auto sm:min-w-80">
            <button
              type="button"
              onClick={() => setActiveFilter((current) => current === "past_due" ? null : "past_due")}
              disabled={data.pastDueCount === 0}
              aria-pressed={activeFilter === "past_due"}
              className={cn(
                "rounded-lg bg-red-50 px-3 py-2 text-red-700 transition-[box-shadow,opacity,scale] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-950/30 dark:text-red-300",
                activeFilter === "past_due" && "ring-2 ring-red-500/40 ring-offset-2 ring-offset-background"
              )}
            >
              <p className="text-[11px] font-medium uppercase tracking-wide">Past Due</p>
              <p className="text-lg font-bold tabular-nums">{data.pastDueCount}</p>
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter((current) => current === "due_soon" ? null : "due_soon")}
              disabled={data.dueSoonCount === 0}
              aria-pressed={activeFilter === "due_soon"}
              className={cn(
                "rounded-lg bg-amber-50 px-3 py-2 text-amber-700 transition-[box-shadow,opacity,scale] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-950/30 dark:text-amber-300",
                activeFilter === "due_soon" && "ring-2 ring-amber-500/40 ring-offset-2 ring-offset-background"
              )}
            >
              <p className="text-[11px] font-medium uppercase tracking-wide">Due Soon</p>
              <p className="text-lg font-bold tabular-nums">{data.dueSoonCount}</p>
            </button>
            <div className="rounded-lg bg-muted/60 px-3 py-2">
              <p className="flex items-center justify-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <span>Total Due</span>
                <ContextTooltip label="Total Due" content={FINANCIAL_CONTEXT.totalDue} />
              </p>
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
        <>
          {activeFilter && (
            <div className="mb-3 flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground">
                Showing {filteredReminders.length} {statusLabel(activeFilter).toLowerCase()} payment{filteredReminders.length === 1 ? "" : "s"}
              </p>
              <button
                type="button"
                onClick={() => setActiveFilter(null)}
                className="self-start rounded-lg px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:self-auto"
              >
                Clear filter
              </button>
            </div>
          )}

          {visibleReminders.length > 0 ? (
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border/60">
              {visibleReminders.map((reminder) => (
                <button
                  key={`${reminder.loanId}-${reminder.dueDate}-${reminder.type}-${reminder.chargeId ?? "monthly"}`}
                  type="button"
                  onClick={() => onLoanClick?.(reminder.loanId)}
                  disabled={!onLoanClick}
                  className={cn(
                    "flex min-h-16 w-full flex-col gap-3 p-4 text-left transition-[background-color,scale] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:flex-row sm:items-center sm:justify-between",
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
                        {typeLabel(reminder.type)}
                      </span>
                    </div>
                    <p className="mt-2 break-words text-sm font-semibold [overflow-wrap:anywhere] sm:truncate">
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
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              No {activeFilter ? statusLabel(activeFilter).toLowerCase() : "matching"} payments in this window.
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
          No upcoming or past due payments need logging.
        </div>
      )}
    </div>
  );
}
