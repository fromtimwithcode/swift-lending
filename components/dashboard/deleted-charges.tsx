"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getPaymentReminderTypeLabel } from "@/convex/lib/paymentReminders";
import { formatUsDate } from "@/lib/dates";
import { getErrorMessage } from "@/lib/errors";
import { formatCurrency } from "@/lib/format";

type DeletedItem = FunctionReturnType<
  typeof api.loanCharges.getDeletedPaymentItemsForLoan
>[number];

const RESTORE_COPY = {
  charge: {
    title: "Restore this charge?",
    description: "The charge is owed again and appears in payment reminders and the borrower portal.",
  },
  reminder: {
    title: "Restore this reminder?",
    description: "The estimated payment reminder appears again here and in the borrower portal.",
  },
} satisfies Record<DeletedItem["kind"], { title: string; description: string }>;

export function DeletedCharges({ loanId }: { loanId: Id<"loans"> }) {
  const items = useQuery(api.loanCharges.getDeletedPaymentItemsForLoan, { loanId });
  const restoreCharge = useMutation(api.loanCharges.restoreCharge);
  const restoreReminder = useMutation(api.loanCharges.restorePaymentReminder);
  const [restoring, setRestoring] = useState<DeletedItem | null>(null);
  const [saving, setSaving] = useState(false);

  if (!items || items.length === 0) return null;

  return (
    <>
      <details className="mt-4 rounded-lg border border-border/60">
        <summary className="min-h-11 cursor-pointer rounded-lg px-4 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:focus-visible:ring-primary">
          Deleted charges <span className="tabular-nums text-muted-foreground">({items.length})</span>
        </summary>
        <ul className="divide-y divide-border border-t border-border/60">
          {items.map((item) => {
            const label = getPaymentReminderTypeLabel(item.type);
            return (
              <li
                key={item.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium">
                    {label} of <span className="tabular-nums">{formatCurrency(item.amount)}</span> due{" "}
                    <span className="tabular-nums">{item.dueDate}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words leading-6 text-muted-foreground [overflow-wrap:anywhere]">
                    {item.reason ?? "No reason was recorded."}
                  </p>
                  {(item.deletedByName || item.deletedAt) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Deleted{item.deletedByName ? ` by ${item.deletedByName}` : ""}
                      {item.deletedAt ? ` on ${formatUsDate(new Date(item.deletedAt))}` : ""}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setRestoring(item)}
                  aria-label={`Restore ${label.toLowerCase()} due ${item.dueDate}`}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  Restore
                </button>
              </li>
            );
          })}
        </ul>
      </details>
      <ConfirmDialog
        open={restoring !== null}
        title={RESTORE_COPY[restoring?.kind ?? "charge"].title}
        description={RESTORE_COPY[restoring?.kind ?? "charge"].description}
        confirmLabel="Restore"
        loading={saving}
        onConfirm={async () => {
          if (!restoring) return;
          setSaving(true);
          try {
            if (restoring.kind === "charge") await restoreCharge({ id: restoring.id });
            else await restoreReminder({ id: restoring.id });
            toast.success(restoring.kind === "charge" ? "Charge restored" : "Reminder restored");
            setRestoring(null);
          } catch (err) {
            toast.error(getErrorMessage(err, "Could not restore. Please try again."));
          } finally {
            setSaving(false);
          }
        }}
        onCancel={() => setRestoring(null)}
      />
    </>
  );
}
