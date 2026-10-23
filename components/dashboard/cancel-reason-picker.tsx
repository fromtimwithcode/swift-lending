"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export const ADMIN_CANCEL_REASONS = [
  "Borrower withdrew",
  "Deal fell through",
  "Duplicate application",
] as const;

export const BORROWER_CANCEL_REASONS = [
  "Deal fell through",
  "Found other financing",
  "No longer needed",
] as const;

export function composeCancelNote(reason: string | null, details: string) {
  return [reason, details.trim()].filter(Boolean).join("\n\n");
}

export function CancelReasonPicker({
  reasons,
  value,
  onChange,
  disabled,
}: {
  reasons: readonly string[];
  value: string | null;
  onChange: (reason: string | null) => void;
  disabled?: boolean;
}) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId}>
      <p
        id={labelId}
        className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm font-medium"
      >
        Reason
        <span className="text-xs font-normal text-muted-foreground">
          Optional
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        {reasons.map((reason) => {
          const selected = value === reason;
          return (
            <button
              key={reason}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(selected ? null : reason)}
              className={cn(
                "min-h-11 rounded-xl border px-4 py-2.5 text-sm font-medium transition-[background-color,border-color,color,scale] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-primary active:scale-[0.96] motion-reduce:active:scale-100 disabled:opacity-60",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:border-ring/30 hover:bg-muted",
              )}
            >
              {reason}
            </button>
          );
        })}
      </div>
    </div>
  );
}
