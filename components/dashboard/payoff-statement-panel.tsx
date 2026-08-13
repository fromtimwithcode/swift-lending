"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Download, FileText, Loader2, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/dashboard/date-picker-field";
import { formatCurrency } from "@/lib/format";
import { formatUsDate, parseUsDate } from "@/lib/dates";
import { downloadPayoffStatementPdf } from "@/lib/payoff-statement-pdf";
import { usePayoffStatement } from "@/hooks/use-payoff-statement";

type PayoffStatementPanelProps = {
  loanId: Id<"loans">;
  maturityDate?: string;
};

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function PayoffSkeleton() {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      aria-label="Calculating current payoff"
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="h-16 animate-pulse rounded-lg bg-muted motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

export function PayoffStatementPanel({
  loanId,
  maturityDate,
}: PayoffStatementPanelProps) {
  const today = startOfDay(new Date());
  const todayValue = formatUsDate(today);
  const maturity = maturityDate ? parseUsDate(maturityDate) : null;
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayValue);
  const [downloading, setDownloading] = useState(false);
  const current = usePayoffStatement(loanId, todayValue);
  const selectedDateValue = parseUsDate(selectedDate);
  const selected = usePayoffStatement(
    loanId,
    selectedDate,
    open && selectedDateValue !== null
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (downloading) return;
    if (nextOpen) setSelectedDate(todayValue);
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
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <FileText className="size-4" aria-hidden="true" />
            Payoff
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Current principal and unpaid interest through today.
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          onClick={() => handleOpenChange(true)}
          disabled={!current.data || current.isLoading}
        >
          <Download data-icon="inline-start" aria-hidden="true" />
          Generate payoff PDF
        </Button>
      </div>

      {current.isLoading ? (
        <PayoffSkeleton />
      ) : current.error ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-sm font-semibold text-destructive">
              Couldn&apos;t calculate this payoff
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {current.error}
            </p>
          </div>
          <Button type="button" variant="outline" size="lg" onClick={current.retry}>
            <RefreshCw data-icon="inline-start" aria-hidden="true" />
            Try again
          </Button>
        </div>
      ) : current.data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Principal</p>
            <p className="mt-1 text-sm font-semibold tabular-nums">
              {formatCurrency(current.data.principal)}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Unpaid Interest</p>
            <p className="mt-1 text-sm font-semibold tabular-nums">
              {formatCurrency(current.data.unpaidInterest)}
            </p>
          </div>
          <div className="rounded-lg bg-primary/8 p-3">
            <p className="text-xs text-muted-foreground">Total Payoff</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-primary">
              {formatCurrency(current.data.totalPayoff)}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Per Diem</p>
            <p className="mt-1 text-sm font-semibold tabular-nums">
              {formatCurrency(current.data.perDiemInterest)}/day
            </p>
          </div>
        </div>
      ) : null}

      <Dialog.Root open={open} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/45 backdrop-blur-[2px] transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
          <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6">
            <Dialog.Popup className="max-h-[calc(100dvh-1rem)] w-full overflow-y-auto rounded-t-2xl bg-card p-5 text-card-foreground shadow-xl transition-[opacity,transform] duration-150 data-[ending-style]:translate-y-2 data-[ending-style]:opacity-0 data-[starting-style]:translate-y-2 data-[starting-style]:opacity-0 motion-reduce:transition-none sm:max-w-lg sm:rounded-2xl sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Dialog.Title className="text-balance text-lg font-semibold">
                    Generate payoff statement
                  </Dialog.Title>
                  <Dialog.Description className="mt-1 text-pretty text-sm leading-6 text-muted-foreground">
                    Choose the date through which the payoff amount will remain valid.
                  </Dialog.Description>
                </div>
                <Dialog.Close
                  disabled={downloading}
                  aria-label="Close payoff statement dialog"
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-[background-color,color,scale] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] disabled:opacity-50"
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
                  minDate={today}
                  maxDate={maturity ?? undefined}
                  ariaLabel="Good-through date"
                  ariaDescribedBy="payoff-date-hint"
                  className="mt-2"
                />
                <p id="payoff-date-hint" className="mt-1.5 text-xs leading-5 text-muted-foreground">
                  Select today{maturity ? ` through ${maturityDate}` : " or a future date"}.
                </p>

                <div className="mt-5 min-h-40" aria-live="polite">
                  {selected.isLoading ? (
                    <PayoffSkeleton />
                  ) : selected.error ? (
                    <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                      <p className="text-sm font-semibold text-destructive">
                        Couldn&apos;t calculate that date
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
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
                    <div className="rounded-xl border border-border bg-muted/30 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Total payoff</p>
                          <p className="mt-1 text-xl font-bold tabular-nums text-primary">
                            {formatCurrency(selected.data.totalPayoff)}
                          </p>
                        </div>
                        <div className="sm:text-right">
                          <p className="text-xs text-muted-foreground">Per diem after this date</p>
                          <p className="mt-1 text-sm font-semibold tabular-nums">
                            {formatCurrency(selected.data.perDiemInterest)}/day
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 border-t border-border pt-3 text-xs sm:grid-cols-2">
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
                    className="inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-[background-color,color,scale] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] disabled:opacity-50"
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
    </div>
  );
}
