"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DatePickerField } from "@/components/dashboard/date-picker-field";
import { Button } from "@/components/ui/button";
import { parseUsDate } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import { downloadPayoffStatementPdf } from "@/lib/payoff-statement-pdf";
import { usePayoffStatement } from "@/hooks/use-payoff-statement";

type PayoffReadiness = FunctionReturnType<
  typeof api.payoffs.getPayoffReadiness
>;

type PayoffStatementPanelProps = {
  loanId: Id<"loans">;
};

function PayoffSkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      role="status"
      aria-label="Calculating payoff"
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="skeleton h-20 rounded-xl motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

function ReadinessBadge({ readiness }: { readiness?: PayoffReadiness }) {
  if (!readiness) {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-muted px-3 text-xs font-semibold text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)]">
        <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        Checking
      </span>
    );
  }

  if (readiness.state === "ready") {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-700 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)] dark:text-emerald-300">
        <ShieldCheck className="size-3.5" aria-hidden="true" />
        Available
      </span>
    );
  }

  if (readiness.state === "completed") {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-700 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)] dark:text-emerald-300">
        <BadgeCheck className="size-3.5" aria-hidden="true" />
        Paid off
      </span>
    );
  }

  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-amber-500/10 px-3 text-xs font-semibold text-amber-800 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.2)] dark:text-amber-200">
      <AlertTriangle className="size-3.5" aria-hidden="true" />
      Needs attention
    </span>
  );
}

export function PayoffStatementPanel({ loanId }: PayoffStatementPanelProps) {
  const readiness = useQuery(api.payoffs.getPayoffReadiness, { loanId });
  const ready = readiness?.state === "ready" ? readiness : null;
  const defaultDate = ready?.defaultGoodThroughDate ?? "";
  const minDate = ready ? parseUsDate(ready.minGoodThroughDate) : null;
  const maxDate = ready?.maxGoodThroughDate
    ? parseUsDate(ready.maxGoodThroughDate)
    : null;
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [downloading, setDownloading] = useState(false);
  const selectedDateValue = parseUsDate(selectedDate);
  const selected = usePayoffStatement(
    loanId,
    selectedDate,
    open && ready !== null && selectedDateValue !== null
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (downloading) return;
    if (nextOpen && ready) setSelectedDate(ready.defaultGoodThroughDate);
    setOpen(nextOpen);
  };

  const handleDownload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected.data || downloading) return;

    setDownloading(true);
    try {
      await downloadPayoffStatementPdf(selected.data);
      toast.success("Payoff statement downloaded");
      setOpen(false);
    } catch {
      toast.error("Unable to create the payoff PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="rounded-2xl bg-card p-5 shadow-[inset_0_0_0_1px_var(--border),0_1px_3px_rgba(0,0,0,0.04),0_12px_36px_rgba(0,0,0,0.035)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-foreground shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_24%,transparent)]">
            <FileText className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 pt-0.5">
            <h3 className="text-balance text-base font-semibold tracking-[-0.02em]">
              Payoff statement
            </h3>
            <p className="mt-1 max-w-xl text-pretty text-sm leading-5 text-muted-foreground">
              Check availability, review the amount, and generate a dated statement.
            </p>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col items-start gap-3 sm:w-auto sm:items-end">
          <ReadinessBadge readiness={readiness} />
          {ready && (
            <Button
              type="button"
              size="lg"
              className="w-full sm:w-auto sm:min-w-48"
              onClick={() => handleOpenChange(true)}
            >
              <Download data-icon="inline-start" aria-hidden="true" />
              Generate statement
            </Button>
          )}
        </div>
      </div>

      <div className="mt-5" aria-live="polite">
        {!readiness ? (
          <PayoffSkeleton />
        ) : readiness.state === "completed" ? (
          <div className="flex items-start gap-3 rounded-xl bg-emerald-500/8 p-4 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.16)]">
            <BadgeCheck className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                This loan has been paid off
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Funds were recorded as returned on{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {readiness.returnedDate}
                </span>
                . No new payoff statement is needed.
              </p>
            </div>
          </div>
        ) : readiness.state === "blocked" ? (
          <div className="rounded-xl bg-amber-500/8 p-4 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.18)] sm:p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-balance text-sm font-semibold text-amber-950 dark:text-amber-100">
                  {readiness.reasons.length === 1
                    ? readiness.reasons[0].title
                    : "Several items need attention"}
                </p>
                <div className="mt-2 space-y-3">
                  {readiness.reasons.map((reason) => (
                    <div key={reason.code}>
                      {readiness.reasons.length > 1 && (
                        <p className="text-sm font-medium text-foreground">
                          {reason.title}
                        </p>
                      )}
                      <p className="text-pretty text-sm leading-6 text-muted-foreground">
                        {reason.message}
                      </p>
                      <p className="mt-1 text-pretty text-xs font-medium leading-5 text-amber-800 dark:text-amber-200">
                        {reason.resolution}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : ready ? (
          <div>
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium">Available to generate</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarClock className="size-3.5" aria-hidden="true" />
                Estimate through{" "}
                <span className="tabular-nums">{defaultDate}</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-xl bg-muted/55 p-3.5 shadow-[inset_0_0_0_1px_var(--border)] sm:p-4">
                <p className="text-xs font-medium text-muted-foreground">Principal</p>
                <p className="mt-1.5 text-sm font-semibold tabular-nums sm:text-base">
                  {formatCurrency(ready.statement.principal)}
                </p>
              </div>
              <div className="rounded-xl bg-muted/55 p-3.5 shadow-[inset_0_0_0_1px_var(--border)] sm:p-4">
                <p className="text-xs font-medium text-muted-foreground">Unpaid interest</p>
                <p className="mt-1.5 text-sm font-semibold tabular-nums sm:text-base">
                  {formatCurrency(ready.statement.unpaidInterest)}
                </p>
              </div>
              <div className="rounded-xl bg-primary/10 p-3.5 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_22%,transparent)] sm:p-4">
                <p className="text-xs font-medium text-muted-foreground">Total payoff</p>
                <p className="mt-1.5 text-base font-bold tabular-nums text-foreground sm:text-lg">
                  {formatCurrency(ready.statement.totalPayoff)}
                </p>
              </div>
              <div className="rounded-xl bg-muted/55 p-3.5 shadow-[inset_0_0_0_1px_var(--border)] sm:p-4">
                <p className="text-xs font-medium text-muted-foreground">Per diem</p>
                <p className="mt-1.5 text-sm font-semibold tabular-nums sm:text-base">
                  {formatCurrency(ready.statement.perDiemInterest)}
                  <span className="ml-0.5 text-xs font-medium text-muted-foreground">/day</span>
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog.Root open={open && ready !== null} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/45 backdrop-blur-[2px] transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
          <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6">
            <Dialog.Popup className="max-h-[calc(100dvh-1rem)] w-full overflow-y-auto rounded-t-3xl bg-card p-5 text-card-foreground shadow-[0_-8px_40px_rgba(0,0,0,0.14)] transition-[opacity,transform] duration-150 data-[ending-style]:translate-y-2 data-[ending-style]:opacity-0 data-[starting-style]:translate-y-2 data-[starting-style]:opacity-0 motion-reduce:transition-none sm:max-w-lg sm:rounded-2xl sm:p-6 sm:shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Dialog.Title className="text-balance text-lg font-semibold tracking-[-0.025em]">
                    Generate payoff statement
                  </Dialog.Title>
                  <Dialog.Description className="mt-1 text-pretty text-sm leading-6 text-muted-foreground">
                    Choose the date through which the payoff amount will remain valid.
                  </Dialog.Description>
                </div>
                <Dialog.Close
                  disabled={downloading}
                  aria-label="Close payoff statement dialog"
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-[background-color,color,scale] duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] disabled:opacity-50"
                >
                  <X className="size-4" aria-hidden="true" />
                </Dialog.Close>
              </div>

              <form className="mt-6" onSubmit={handleDownload}>
                <label htmlFor="payoff-good-through-date" className="text-sm font-medium">
                  Good-through date
                </label>
                <DatePickerField
                  id="payoff-good-through-date"
                  value={selectedDate}
                  onChange={setSelectedDate}
                  required
                  minDate={minDate ?? undefined}
                  maxDate={maxDate ?? undefined}
                  ariaLabel="Good-through date"
                  ariaDescribedBy="payoff-date-hint"
                  className="mt-2"
                />
                <p id="payoff-date-hint" className="mt-1.5 text-pretty text-xs leading-5 text-muted-foreground">
                  Select {ready?.minGoodThroughDate ?? "an available date"}
                  {ready?.maxGoodThroughDate
                    ? ` through ${ready.maxGoodThroughDate}`
                    : " or a later date"}
                  .
                </p>

                <div className="mt-5 min-h-40" aria-live="polite">
                  {selected.isLoading ? (
                    <PayoffSkeleton />
                  ) : selected.error ? (
                    <div role="alert" className="rounded-xl bg-destructive/6 p-4 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--destructive)_18%,transparent)]">
                      <p className="text-sm font-semibold text-destructive">
                        Couldn&apos;t calculate that date
                      </p>
                      <p className="mt-1 text-pretty text-sm leading-6 text-muted-foreground">
                        {selected.error}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        className="mt-3"
                        onClick={selected.retry}
                      >
                        <RefreshCw data-icon="inline-start" aria-hidden="true" />
                        Try again
                      </Button>
                    </div>
                  ) : selected.data ? (
                    <div className="rounded-xl bg-muted/35 p-4 shadow-[inset_0_0_0_1px_var(--border)]">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Total payoff</p>
                          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                            {formatCurrency(selected.data.totalPayoff)}
                          </p>
                        </div>
                        <div className="sm:text-right">
                          <p className="text-xs font-medium text-muted-foreground">Per diem after this date</p>
                          <p className="mt-1 text-sm font-semibold tabular-nums">
                            {formatCurrency(selected.data.perDiemInterest)}/day
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 pt-3 text-xs shadow-[inset_0_1px_0_var(--border)] sm:grid-cols-2">
                        <p className="flex justify-between gap-3 sm:block">
                          <span className="text-muted-foreground">Principal</span>{" "}
                          <span className="font-medium tabular-nums">
                            {formatCurrency(selected.data.principal)}
                          </span>
                        </p>
                        <p className="flex justify-between gap-3 sm:block sm:text-right">
                          <span className="text-muted-foreground">Unpaid interest</span>{" "}
                          <span className="font-medium tabular-nums">
                            {formatCurrency(selected.data.unpaidInterest)}
                          </span>
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Dialog.Close
                    disabled={downloading}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-[background-color,color,scale] duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] disabled:opacity-50"
                  >
                    Cancel
                  </Dialog.Close>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={!selected.data || selected.isLoading || downloading}
                    aria-busy={downloading}
                  >
                    {downloading ? (
                      <Loader2
                        data-icon="inline-start"
                        className="animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    ) : (
                      <Download data-icon="inline-start" aria-hidden="true" />
                    )}
                    Download PDF
                  </Button>
                </div>
              </form>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
