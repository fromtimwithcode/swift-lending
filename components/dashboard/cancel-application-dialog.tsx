"use client";

import { useId, useRef, useState } from "react";
import { FormDialog, FormError } from "@/components/dashboard/form-dialog";
import {
  BORROWER_CANCEL_REASONS,
  CancelReasonPicker,
  composeCancelNote,
} from "@/components/dashboard/cancel-reason-picker";
import { getErrorMessage } from "@/lib/errors";
import {
  getStatusNoteError,
  STATUS_NOTE_MAX_LENGTH,
} from "@/convex/lib/loanStatus";

export function CancelApplicationDialog({
  propertyAddress,
  onConfirm,
  onClose,
  finalFocus,
}: {
  propertyAddress: string;
  onConfirm: (note: string) => Promise<void>;
  onClose: () => void;
  finalFocus: () => HTMLElement | null;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const note = composeCancelNote(reason, details);

  function validate() {
    const validationError = getStatusNoteError("canceled", note);
    setError(validationError);
    if (validationError) field.current?.focus();
    return validationError === null;
  }

  async function submit() {
    try {
      await onConfirm(note);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Could not cancel the application. Please try again."));
    }
  }

  return (
    <FormDialog
      title="Cancel this application?"
      description={`Your application for ${propertyAddress} will be canceled and our team will be notified. To reopen it later, send us a message.`}
      submitLabel="Cancel application"
      savingLabel="Canceling…"
      cancelLabel="Keep application"
      destructive
      validate={validate}
      onSubmit={submit}
      onClose={onClose}
      initialFocus={field}
      finalFocus={finalFocus}
    >
      <CancelReasonPicker
        reasons={BORROWER_CANCEL_REASONS}
        value={reason}
        onChange={(next) => {
          setReason(next);
          setError(null);
        }}
      />
      <div>
        <label
          htmlFor={id}
          className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm font-medium"
        >
          Anything else we should know?
          <span className="text-xs font-normal text-muted-foreground">Optional</span>
        </label>
        <textarea
          ref={field}
          id={id}
          value={details}
          onChange={(event) => {
            setDetails(event.target.value);
            setError(null);
          }}
          maxLength={STATUS_NOTE_MAX_LENGTH}
          rows={3}
          aria-invalid={error !== null}
          aria-describedby={`${id}-count${error ? ` ${id}-error` : ""}`}
          className="block min-h-24 w-full resize-y rounded-xl border border-input bg-background px-3.5 py-3 text-base leading-6 transition-[border-color,box-shadow] duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15 dark:focus:border-primary/70 dark:focus:ring-primary/20 disabled:opacity-60 aria-invalid:border-destructive sm:text-sm"
        />
        <p
          id={`${id}-count`}
          className="mt-2 text-right text-xs leading-5 text-muted-foreground tabular-nums"
        >
          {note.length.toLocaleString("en-US")} / {STATUS_NOTE_MAX_LENGTH.toLocaleString("en-US")}
        </p>
        <div className="mt-1">
          <FormError id={`${id}-error`} message={error} />
        </div>
      </div>
    </FormDialog>
  );
}
