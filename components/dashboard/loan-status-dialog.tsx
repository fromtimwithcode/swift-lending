"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowRight, Loader2, MessageSquareText } from "lucide-react";
import { useId, useRef, useState } from "react";
import { StatusBadge } from "./status-badge";
import { getErrorMessage } from "@/lib/errors";
import { getLoanStatusLabel } from "@/lib/loan-display";
import {
  getStatusNoteError,
  requiresStatusNote,
  STATUS_NOTE_MAX_LENGTH,
  LOAN_STATUSES,
  type LoanStatus,
} from "@/convex/lib/loanStatus";

export type LoanStatusChange = {
  status?: LoanStatus;
  currentStatus?: LoanStatus;
  propertyAddress?: string;
  count?: number;
};

export function LoanStatusDialog({
  change,
  onSave,
  onClose,
  finalFocus,
}: {
  change: LoanStatusChange;
  onSave: (note: string, status: LoanStatus) => Promise<void>;
  onClose: () => void;
  finalFocus?: () => HTMLElement | null;
}) {
  const [status, setStatus] = useState<LoanStatus | "">(change.status ?? "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [invalidField, setInvalidField] = useState<"status" | "note" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const statusField = useRef<HTMLSelectElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const required = status !== "" && requiresStatusNote(status);
  const isBulk = change.count !== undefined;
  const label =
    status === "additional_info_needed"
      ? "What information is needed?"
      : status === "denied"
        ? "Reason for denial"
        : "Note to borrower";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (!status) {
      setError("Choose a new status.");
      setInvalidField("status");
      statusField.current?.focus();
      return;
    }
    const validationError = getStatusNoteError(status, note);
    if (validationError) {
      setError(validationError);
      setInvalidField("note");
      field.current?.focus();
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError(null);
    setInvalidField(null);
    try {
      await onSave(note.trim(), status);
      onClose();
    } catch (err) {
      setError(
        getErrorMessage(err, "Could not save the status. Please try again."),
      );
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !submitting.current) onClose();
      }}
      disablePointerDismissal
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/45" />
        <Dialog.Viewport className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-4 sm:p-6">
          <Dialog.Popup
            finalFocus={finalFocus}
            initialFocus={isBulk ? true : field}
            className="my-auto max-h-[calc(100dvh_-_2rem)] w-full max-w-lg overflow-hidden rounded-3xl bg-card text-card-foreground shadow-[0_24px_80px_rgba(0,0,0,0.2),0_4px_16px_rgba(0,0,0,0.08),inset_0_0_0_1px_var(--border)] outline-none"
          >
            <form
              onSubmit={submit}
              noValidate
              aria-busy={saving}
              className="flex max-h-[calc(100dvh_-_2rem)] flex-col"
            >
              <div className="min-h-0 space-y-5 overflow-y-auto p-5 sm:p-7">
                <div>
                  <Dialog.Title className="text-balance text-xl font-semibold tracking-tight">
                    {isBulk
                      ? `Update ${change.count} ${change.count === 1 ? "loan" : "loans"}`
                      : "Update loan status"}
                  </Dialog.Title>
                  <Dialog.Description className="mt-2 break-words text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
                    {isBulk
                      ? "The same explanation will be shared with each borrower whose loan is updated."
                      : change.propertyAddress}
                  </Dialog.Description>
                </div>
                {isBulk ? (
                  <div>
                    <label
                      htmlFor={`${id}-status`}
                      className="mb-2 block text-sm font-medium"
                    >
                      New status
                    </label>
                    <select
                      ref={statusField}
                      aria-invalid={invalidField === "status"}
                      aria-describedby={
                        invalidField === "status" ? `${id}-error` : undefined
                      }
                      id={`${id}-status`}
                      value={status}
                      disabled={saving}
                      onChange={(event) => {
                        setStatus(event.target.value as LoanStatus);
                        setError(null);
                        setInvalidField(null);
                      }}
                      className="min-h-11 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-base focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15 dark:focus:border-primary/70 dark:focus:ring-primary/20 disabled:opacity-60 sm:text-sm"
                    >
                      <option value="" disabled>
                        Choose a status
                      </option>
                      {LOAN_STATUSES.map((item) => (
                        <option key={item} value={item}>
                          {getLoanStatusLabel(item)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div
                    className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/60 p-3.5"
                    aria-label="Status change"
                  >
                    {change.currentStatus && (
                      <>
                        <StatusBadge status={change.currentStatus} />
                        <ArrowRight
                          aria-hidden="true"
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                      </>
                    )}
                    {status && <StatusBadge status={status} />}
                  </div>
                )}
                <div>
                  <label
                    htmlFor={id}
                    className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm font-medium"
                  >
                    {label}
                    <span className="text-xs font-normal text-muted-foreground">
                      {required ? "Required" : "Optional"}
                    </span>
                  </label>
                  <textarea
                    ref={field}
                    id={id}
                    value={note}
                    onChange={(event) => {
                      setNote(event.target.value);
                      setError(null);
                      setInvalidField(null);
                    }}
                    required={required}
                    disabled={saving}
                    maxLength={STATUS_NOTE_MAX_LENGTH}
                    rows={4}
                    aria-invalid={invalidField === "note"}
                    aria-describedby={`${id}-hint ${id}-count${error ? ` ${id}-error` : ""}`}
                    placeholder={
                      status === "additional_info_needed"
                        ? "List the documents or details the borrower should provide…"
                        : status === "denied"
                          ? "Explain why this loan cannot move forward…"
                          : "Add context or next steps…"
                    }
                    className="block min-h-32 w-full resize-y rounded-xl border border-input bg-background px-3.5 py-3 text-base leading-6 transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/80 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15 dark:focus:border-primary/70 dark:focus:ring-primary/20 disabled:opacity-60 aria-invalid:border-destructive sm:text-sm"
                  />
                  <div className="mt-2 flex items-start justify-between gap-3 text-xs leading-5 text-muted-foreground">
                    <p
                      id={`${id}-hint`}
                      className="flex items-start gap-1.5 text-pretty"
                    >
                      <MessageSquareText
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0"
                        strokeWidth={1.5}
                      />
                      Visible to the borrower and included in status
                      notifications.
                    </p>
                    <span id={`${id}-count`} className="shrink-0 tabular-nums">
                      {note.length.toLocaleString("en-US")} / 2,000
                    </span>
                  </div>
                  {error && (
                    <p
                      id={`${id}-error`}
                      role="alert"
                      className="mt-3 break-words text-sm leading-6 text-destructive dark:text-red-300 [overflow-wrap:anywhere]"
                    >
                      {error}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
                <Dialog.Close
                  disabled={saving}
                  className="min-h-11 rounded-xl px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:focus-visible:ring-primary disabled:opacity-50"
                >
                  Cancel
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-[background-color,scale] duration-150 hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.96] motion-reduce:active:scale-100 disabled:opacity-60 disabled:active:scale-100"
                >
                  {saving && (
                    <Loader2
                      className="size-4 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  )}
                  <span aria-live="polite">
                    {saving
                      ? "Saving…"
                      : isBulk
                        ? change.count === 1 ? "Update loan" : "Update loans"
                        : "Save status"}
                  </span>
                </button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
