"use client";

import { useId, useRef, useState } from "react";
import { FormDialog, FormError } from "@/components/dashboard/form-dialog";
import { getErrorMessage } from "@/lib/errors";
import { formatCurrency } from "@/lib/format";
import {
  DELETE_REASON_MAX_LENGTH,
  getDeleteReasonError,
  getPaymentReminderTypeLabel,
} from "@/convex/lib/paymentReminders";

export function DeleteChargeDialog({
  title,
  description,
  confirmLabel,
  charge,
  onDelete,
  onClose,
  finalFocus,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  charge: {
    borrowerName: string;
    propertyAddress: string;
    amount: number;
    dueDate: string;
    type: string;
  };
  onDelete: (reason: string) => Promise<void>;
  onClose: () => void;
  finalFocus: () => HTMLElement | null;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const id = useId();

  function validate() {
    const validationError = getDeleteReasonError(reason);
    setError(validationError);
    if (validationError) field.current?.focus();
    return validationError === null;
  }

  async function submit() {
    try {
      await onDelete(reason.trim());
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Could not delete. Please try again."));
    }
  }

  return (
    <FormDialog
      title={title}
      description={description}
      submitLabel={confirmLabel}
      savingLabel="Deleting…"
      destructive
      validate={validate}
      onSubmit={submit}
      onClose={onClose}
      initialFocus={field}
      finalFocus={finalFocus}
    >
      <div className="rounded-xl bg-muted/60 p-3.5 text-sm">
        <p className="break-words font-semibold [overflow-wrap:anywhere]">
          {charge.borrowerName} - {charge.propertyAddress}
        </p>
        <p className="mt-1 text-muted-foreground">
          {getPaymentReminderTypeLabel(charge.type)} of{" "}
          <span className="tabular-nums">{formatCurrency(charge.amount)}</span> due{" "}
          <span className="tabular-nums">{charge.dueDate}</span>
        </p>
      </div>
      <div>
        <label
          htmlFor={id}
          className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm font-medium"
        >
          Reason for deleting
          <span className="text-xs font-normal text-muted-foreground">Required</span>
        </label>
        <textarea
          ref={field}
          id={id}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setError(null);
          }}
          required
          maxLength={DELETE_REASON_MAX_LENGTH}
          rows={4}
          aria-invalid={error !== null}
          aria-describedby={`${id}-count${error ? ` ${id}-error` : ""}`}
          className="block min-h-32 w-full resize-y rounded-xl border border-input bg-background px-3.5 py-3 text-base leading-6 transition-[border-color,box-shadow] duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15 dark:focus:border-primary/70 dark:focus:ring-primary/20 disabled:opacity-60 aria-invalid:border-destructive sm:text-sm"
        />
        <p
          id={`${id}-count`}
          className="mt-2 text-right text-xs leading-5 text-muted-foreground tabular-nums"
        >
          {reason.length.toLocaleString("en-US")} / {DELETE_REASON_MAX_LENGTH.toLocaleString("en-US")}
        </p>
        <div className="mt-1">
          <FormError id={`${id}-error`} message={error} />
        </div>
      </div>
    </FormDialog>
  );
}
