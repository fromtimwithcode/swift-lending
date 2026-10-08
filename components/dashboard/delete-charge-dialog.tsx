"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Loader2 } from "lucide-react";
import { useId, useRef, useState } from "react";
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const id = useId();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    const validationError = getDeleteReasonError(reason);
    if (validationError) {
      setError(validationError);
      field.current?.focus();
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError(null);
    try {
      await onDelete(reason.trim());
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Could not delete. Please try again."));
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
            initialFocus={field}
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
                    {title}
                  </Dialog.Title>
                  <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground text-pretty">
                    {description}
                  </Dialog.Description>
                </div>
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
                    disabled={saving}
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
                  {error && (
                    <p
                      id={`${id}-error`}
                      role="alert"
                      className="mt-1 break-words text-sm leading-6 text-destructive dark:text-red-300 [overflow-wrap:anywhere]"
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
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-destructive px-5 py-2.5 text-sm font-semibold text-white transition-[background-color,scale] duration-150 hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:focus-visible:ring-primary active:scale-[0.96] motion-reduce:active:scale-100 disabled:opacity-60 disabled:active:scale-100"
                >
                  {saving && (
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  )}
                  <span aria-live="polite">{saving ? "Deleting…" : confirmLabel}</span>
                </button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
