"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Loader2 } from "lucide-react";
import { useRef, useState, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/utils";

export function FormDialog({
  title,
  description,
  submitLabel,
  savingLabel,
  destructive = false,
  validate,
  onSubmit,
  onClose,
  initialFocus,
  finalFocus,
  children,
}: {
  title: string;
  description: string;
  submitLabel: string;
  savingLabel: string;
  destructive?: boolean;
  /** Runs before the fields are disabled, so it can move focus to an invalid field. */
  validate: () => boolean;
  onSubmit: () => Promise<void>;
  onClose: () => void;
  initialFocus: RefObject<HTMLElement | null>;
  finalFocus: () => HTMLElement | null;
  children: ReactNode;
}) {
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current || !validate()) return;
    submitting.current = true;
    setSaving(true);
    try {
      await onSubmit();
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
            initialFocus={initialFocus}
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
                <fieldset disabled={saving} className="min-w-0 space-y-5">
                  {children}
                </fieldset>
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
                  className={cn(
                    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-[background-color,scale] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:focus-visible:ring-primary active:scale-[0.96] motion-reduce:active:scale-100 disabled:opacity-60 disabled:active:scale-100",
                    destructive
                      ? "bg-destructive text-white hover:bg-destructive/90"
                      : "bg-primary text-primary-foreground hover:bg-primary/85"
                  )}
                >
                  {saving && (
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  )}
                  <span aria-live="polite">{saving ? savingLabel : submitLabel}</span>
                </button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const formFieldClassName =
  "block min-h-11 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-base leading-6 transition-[border-color,box-shadow] duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15 dark:focus:border-primary/70 dark:focus:ring-primary/20 disabled:opacity-60 aria-invalid:border-destructive sm:text-sm";

export function FormError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="break-words text-sm leading-6 text-destructive dark:text-red-300 [overflow-wrap:anywhere]"
    >
      {message}
    </p>
  );
}
