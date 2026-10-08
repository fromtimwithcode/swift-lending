"use client";

import type { Ref } from "react";
import { StatusBadge } from "./status-badge";
import { LoanStatusNote } from "./loan-status-note";
import {
  getNextLoanStatuses,
  type LoanStatus,
} from "@/convex/lib/loanStatus";
import { getLoanStatusLabel } from "@/lib/loan-display";

export function LoanStatusControls({
  status,
  note,
  returnedDate,
  onSelect,
  ref,
}: {
  status: LoanStatus;
  note?: string;
  returnedDate?: string;
  onSelect: (status: LoanStatus, trigger: HTMLButtonElement) => void;
  ref?: Ref<HTMLElement>;
}) {
  const nextStatuses = returnedDate ? [] : getNextLoanStatuses(status);
  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-label="Loan status"
      className="outline-none space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Loan status</h2>
        <StatusBadge status={status} />
      </div>
      <LoanStatusNote status={status} note={note} />
      {nextStatuses.length > 0 ? (
        <div>
          <p className="mb-3 text-sm text-muted-foreground">
            Move this loan to
          </p>
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map((next) => (
              <button
                key={next}
                type="button"
                onClick={(event) => {
                  event.currentTarget.focus();
                  onSelect(next, event.currentTarget);
                }}
                className="min-h-11 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium transition-[background-color,border-color,scale] duration-150 hover:border-ring/30 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-primary active:scale-[0.96] motion-reduce:active:scale-100"
              >
                {getLoanStatusLabel(next)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {returnedDate
            ? "Funds have been returned. This loan is closed."
            : "This loan is closed."}
        </p>
      )}
    </section>
  );
}
