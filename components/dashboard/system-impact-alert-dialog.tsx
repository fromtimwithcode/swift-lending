"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { AlertTriangle, Check, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface ConfigurationImpactPreview {
  hasChanges: boolean;
  changes: Array<{
    key: string;
    label: string;
    effect: "new_loans" | "immediate" | "rebuild";
    beforeDisplay: string;
    afterDisplay: string;
  }>;
  affectedSurfaces: string[];
  affectsNewLoans: boolean;
  hasImmediateOperationalImpact: boolean;
  rebuildsComparables: boolean;
  requiresAcknowledgement: boolean;
  protectedRecords: string[];
}

interface SystemImpactAlertDialogProps {
  open: boolean;
  preview?: ConfigurationImpactPreview;
  loadingPreview: boolean;
  applying: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onApply: (reason?: string) => void | Promise<void>;
}

const EFFECT_LABELS: Record<
  ConfigurationImpactPreview["changes"][number]["effect"],
  string
> = {
  new_loans: "New loans only",
  immediate: "Applies immediately",
  rebuild: "Rebuilds comparable rankings",
};

export function SystemImpactAlertDialog({
  open,
  preview,
  loadingPreview,
  applying,
  error,
  onOpenChange,
  onApply,
}: SystemImpactAlertDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [reason, setReason] = useState("");

  const canApply =
    Boolean(preview?.hasChanges) &&
    (!preview?.requiresAcknowledgement || acknowledged) &&
    !applying;

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (applying) return;
        if (!nextOpen) {
          setAcknowledged(false);
          setReason("");
        }
        onOpenChange(nextOpen);
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-foreground/45 backdrop-blur-[2px] transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <AlertDialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6">
          <AlertDialog.Popup className="max-h-[calc(100dvh-1rem)] w-full overflow-y-auto rounded-t-2xl bg-card p-5 text-card-foreground shadow-xl transition-[opacity,transform] duration-150 data-[ending-style]:translate-y-2 data-[ending-style]:opacity-0 data-[starting-style]:translate-y-2 data-[starting-style]:opacity-0 motion-reduce:transition-none sm:max-w-2xl sm:rounded-2xl sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <AlertDialog.Title className="text-balance text-lg font-semibold">
                  Apply these settings app-wide?
                </AlertDialog.Title>
                <AlertDialog.Description className="mt-1 text-pretty text-sm leading-6 text-muted-foreground">
                  Review the operational impact before publishing this configuration.
                  Contractual and posted accounting records remain protected.
                </AlertDialog.Description>
              </div>
            </div>

            {loadingPreview ? (
              <div className="mt-6 space-y-3" aria-label="Preparing change impact">
                <div className="h-16 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
                <div className="h-24 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
              </div>
            ) : preview ? (
              <div className="mt-6 space-y-5">
                <section aria-labelledby="configuration-changes-heading">
                  <h3 id="configuration-changes-heading" className="text-sm font-semibold">
                    Changes
                  </h3>
                  <div className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
                    {preview.changes.map((change) => (
                      <div
                        key={change.key}
                        className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{change.label}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {EFFECT_LABELS[change.effect]}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-sm tabular-nums sm:justify-end">
                          <span className="text-muted-foreground line-through">
                            {change.beforeDisplay}
                          </span>
                          <span aria-hidden="true">→</span>
                          <span className="font-semibold">{change.afterDisplay}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="grid gap-3 sm:grid-cols-2">
                  <section className="rounded-xl bg-amber-500/8 p-4" aria-labelledby="affected-heading">
                    <h3 id="affected-heading" className="text-sm font-semibold">
                      What changes
                    </h3>
                    <ul className="mt-2 space-y-1.5 text-xs leading-5 text-muted-foreground">
                      {preview.affectedSurfaces.map((surface) => (
                        <li key={surface} className="flex gap-2">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                          <span>{surface}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section className="rounded-xl bg-emerald-500/8 p-4" aria-labelledby="protected-heading">
                    <h3 id="protected-heading" className="text-sm font-semibold">
                      What stays unchanged
                    </h3>
                    <ul className="mt-2 space-y-1.5 text-xs leading-5 text-muted-foreground">
                      {preview.protectedRecords.map((record) => (
                        <li key={record} className="flex gap-2">
                          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                          <span>{record}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>

                {preview.rebuildsComparables && (
                  <p className="rounded-xl bg-muted px-4 py-3 text-xs leading-5 text-muted-foreground">
                    Existing comparable-property rankings will rebuild in the
                    background. Stored rankings remain visible and are replaced as
                    each loan is rebuilt with the new rules.
                  </p>
                )}

                <div className="space-y-2">
                  <label htmlFor="configuration-change-reason" className="text-sm font-medium">
                    Change reason <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <textarea
                    id="configuration-change-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={500}
                    rows={2}
                    disabled={applying}
                    className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Example: Updated Q3 lending policy"
                  />
                </div>

                {preview.requiresAcknowledgement && (
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={acknowledged}
                      onChange={(event) => setAcknowledged(event.target.checked)}
                      disabled={applying}
                      className="mt-0.5 size-4 accent-primary"
                    />
                    <span className="text-pretty">
                      I reviewed the app-wide impact and understand which records are protected.
                    </span>
                  </label>
                )}
              </div>
            ) : null}

            {error && (
              <div role="alert" className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <AlertDialog.Close
                disabled={applying}
                className="inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-[background-color,color,scale] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] disabled:opacity-50"
              >
                Cancel
              </AlertDialog.Close>
              <button
                type="button"
                onClick={() => onApply(reason.trim() || undefined)}
                disabled={!canApply}
                aria-busy={applying}
                className={cn(
                  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-[background-color,opacity,scale] hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
                )}
              >
                {applying ? (
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <Check className="size-4" aria-hidden="true" />
                )}
                Apply app-wide
              </button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
