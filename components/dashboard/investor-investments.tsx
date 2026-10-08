"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Banknote, Pencil, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { InvestmentFormDialog } from "@/components/dashboard/investment-form-dialog";
import { RecordPayoutDialog } from "@/components/dashboard/record-payout-dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PAYMENT_METHOD_LABELS } from "@/convex/lib/constants";
import { formatCalendarDay, getPaymentDayLabel } from "@/convex/lib/investmentSchedule";
import { getErrorMessage } from "@/lib/errors";
import { formatCurrency } from "@/lib/format";

type Portfolio = FunctionReturnType<typeof api.investments.getInvestorDetail>;
type Investment = Portfolio["investments"][number];
type Payout = Investment["payouts"][number];

type DialogState =
  | { kind: "create" }
  | { kind: "edit"; investment: Investment }
  | { kind: "payout"; investment: Investment }
  | { kind: "deleteInvestment"; investment: Investment }
  | { kind: "deletePayout"; investment: Investment; payout: Payout };

const iconButtonClassName =
  "inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:focus-visible:ring-primary";

export function getInvestmentLabel(investment: { investmentAmount: number; interestRate: number }) {
  return `${formatCurrency(investment.investmentAmount)} investment at ${investment.interestRate}%`;
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
      {detail && <dd className="mt-0.5 text-xs text-muted-foreground tabular-nums">{detail}</dd>}
    </div>
  );
}

export function describeNextPayment(investment: Investment, today: number) {
  const next = investment.summary.nextPayment;
  if (!next) return { value: "None", detail: "No interest is due" };
  return {
    value: formatCurrency(next.amount),
    detail: next.dueDate === today ? "Due today" : `Due ${formatCalendarDay(next.dueDate)}`,
  };
}

function InvestmentCard({
  investment,
  today,
  onOpen,
}: {
  investment: Investment;
  today: number;
  onOpen: (dialog: DialogState, trigger: HTMLElement) => void;
}) {
  const { summary } = investment;
  const label = getInvestmentLabel(investment);
  const next = describeNextPayment(investment, today);
  return (
    <article aria-label={label} className="rounded-xl border border-border p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-base font-semibold tabular-nums">
            {formatCurrency(investment.investmentAmount)} at {investment.interestRate}%
          </h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Started <span className="tabular-nums">{formatCalendarDay(investment.inceptionDate)}</span> · paid
            monthly on {getPaymentDayLabel(investment.firstPaymentDate)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(event) => onOpen({ kind: "payout", investment }, event.currentTarget)}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:focus-visible:ring-primary"
          >
            <Banknote className="size-4" aria-hidden="true" />
            Record payment
          </button>
          <button
            type="button"
            onClick={(event) => onOpen({ kind: "edit", investment }, event.currentTarget)}
            aria-label={`Edit ${label}`}
            className={iconButtonClassName}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(event) => onOpen({ kind: "deleteInvestment", investment }, event.currentTarget)}
            aria-label={`Delete ${label}`}
            className={`${iconButtonClassName} hover:text-red-600`}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {summary.pastDue && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-900/20 dark:text-red-300">
          <span className="tabular-nums">{formatCurrency(summary.pastDue.amount)}</span> past due since{" "}
          <span className="tabular-nums">{formatCalendarDay(summary.pastDue.since)}</span>
        </p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Next payment" value={next.value} detail={next.detail} />
        <Stat label="Monthly payment" value={formatCurrency(summary.monthlyPayment)} detail="Annual rate ÷ 12" />
        <Stat
          label="Interest earned"
          value={formatCurrency(summary.interestEarned)}
          detail="Since inception"
        />
        <Stat
          label="Paid to date"
          value={formatCurrency(summary.paidToDate)}
          detail={
            summary.unpaidInterest > 0
              ? `${formatCurrency(summary.unpaidInterest)} earned, not yet paid`
              : "All earned interest paid"
          }
        />
      </dl>

      {investment.notes && (
        <p className="mt-4 whitespace-pre-wrap break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
          <span className="font-medium text-foreground">Notes: </span>
          {investment.notes}
        </p>
      )}

      {investment.payouts.length > 0 && (
        <details className="mt-4 rounded-lg border border-border/60">
          <summary className="min-h-11 cursor-pointer rounded-lg px-4 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:focus-visible:ring-primary">
            Payment history <span className="tabular-nums text-muted-foreground">({investment.payouts.length})</span>
          </summary>
          <ul className="divide-y divide-border border-t border-border/60">
            {investment.payouts.map((payout) => (
              <li key={payout._id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium tabular-nums">
                    {formatCurrency(payout.amount)}{" "}
                    <span className="font-normal text-muted-foreground">
                      {PAYMENT_METHOD_LABELS[payout.method]} · {formatCalendarDay(payout.paidDate)}
                    </span>
                  </p>
                  {payout.notes && (
                    <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">{payout.notes}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(event) => onOpen({ kind: "deletePayout", investment, payout }, event.currentTarget)}
                  aria-label={`Delete ${formatCurrency(payout.amount)} payment from ${formatCalendarDay(payout.paidDate)}`}
                  className={`${iconButtonClassName} shrink-0 hover:text-red-600`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

export function InvestorInvestments({
  investorId,
  portfolio,
}: {
  investorId: Id<"userProfiles">;
  portfolio: Portfolio;
}) {
  const create = useMutation(api.investments.create);
  const update = useMutation(api.investments.update);
  const remove = useMutation(api.investments.remove);
  const recordPayout = useMutation(api.investments.recordPayout);
  const removePayout = useMutation(api.investments.removePayout);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [deleting, setDeleting] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const section = useRef<HTMLElement>(null);

  const open = (next: DialogState, element: HTMLElement) => {
    trigger.current = element;
    setDialog(next);
  };
  const close = () => setDialog(null);
  const finalFocus = () => (trigger.current?.isConnected ? trigger.current : section.current);

  async function confirmDelete() {
    if (dialog?.kind !== "deleteInvestment" && dialog?.kind !== "deletePayout") return;
    setDeleting(true);
    try {
      if (dialog.kind === "deleteInvestment") {
        await remove({ id: dialog.investment._id });
        toast.success("Investment deleted");
      } else {
        await removePayout({ id: dialog.payout._id });
        toast.success("Payment deleted");
      }
      setDialog(null);
      finalFocus()?.focus();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not delete. Please try again."));
    } finally {
      setDeleting(false);
    }
  }

  const { investments, today } = portfolio;
  const deleteInvestmentBlocked = dialog?.kind === "deleteInvestment" && dialog.investment.payouts.length > 0;

  return (
    <section ref={section} tabIndex={-1} aria-labelledby="investments-heading" className="rounded-xl border border-border bg-card p-4 outline-none sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 id="investments-heading" className="text-sm font-medium text-muted-foreground">
          Investments ({investments.length})
        </h3>
        <button
          type="button"
          onClick={(event) => open({ kind: "create" }, event.currentTarget)}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add investment
        </button>
      </div>

      {investments.length > 0 ? (
        <div className="space-y-4">
          {investments.map((investment) => (
            <InvestmentCard key={investment._id} investment={investment} today={today} onOpen={open} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No investments yet</p>
      )}

      {(dialog?.kind === "create" || dialog?.kind === "edit") && (
        <InvestmentFormDialog
          investment={dialog.kind === "edit" ? dialog.investment : null}
          onSave={async (values) => {
            if (dialog.kind === "edit") {
              await update({ id: dialog.investment._id, ...values });
              toast.success("Investment updated");
            } else {
              await create({ investorId, ...values });
              toast.success("Investment added");
            }
          }}
          onClose={close}
          finalFocus={finalFocus}
        />
      )}

      {dialog?.kind === "payout" && (
        <RecordPayoutDialog
          investmentLabel={getInvestmentLabel(dialog.investment)}
          inceptionDate={dialog.investment.inceptionDate}
          suggestedAmount={
            dialog.investment.summary.pastDue?.amount ?? dialog.investment.summary.nextPayment?.amount ?? null
          }
          today={today}
          onSave={async (values) => {
            await recordPayout({ investmentId: dialog.investment._id, ...values });
            toast.success("Payment recorded");
          }}
          onClose={close}
          finalFocus={finalFocus}
        />
      )}

      <ConfirmDialog
        open={dialog?.kind === "deleteInvestment" || dialog?.kind === "deletePayout"}
        title={dialog?.kind === "deletePayout" ? "Delete this payment?" : "Delete this investment?"}
        description={
          dialog?.kind === "deletePayout"
            ? `The ${formatCurrency(dialog.payout.amount)} payment from ${formatCalendarDay(dialog.payout.paidDate)} will no longer count as paid.`
            : deleteInvestmentBlocked
              ? "Delete this investment's recorded payments first. They're listed under Payment history."
              : "This removes the investment and its payment schedule. This can't be undone."
        }
        confirmLabel="Delete"
        confirmDisabled={deleteInvestmentBlocked}
        variant="destructive"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={close}
      />
    </section>
  );
}
