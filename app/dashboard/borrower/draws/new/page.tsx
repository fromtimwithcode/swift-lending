"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import { isDrawEligibleLoan } from "@/convex/lib/constants";
import { DetailPageSkeleton } from "@/components/dashboard/skeleton";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { getFundingLedgerStatus } from "@/convex/lib/fundingLedger";

export default function NewDrawRequestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedLoanId = searchParams.get("loanId");

  const [loanId, setLoanId] = useState(preselectedLoanId ?? "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const loans = useQuery(api.borrower.getMyLoans);
  const drawEligibleLoans = loans?.filter(isDrawEligibleLoan) ?? [];
  const selectedLoan = drawEligibleLoans.find((l) => l._id === loanId);
  const draws = useQuery(
    api.borrower.getDrawRequestsForLoan,
    selectedLoan ? { loanId: selectedLoan._id } : "skip"
  );
  const submitDraw = useMutation(api.borrower.submitDrawRequest);

  if (loans === undefined) {
    return <DetailPageSkeleton />;
  }

  const pendingTotal = (draws ?? [])
    .filter((d) => d.status === "pending" || d.status === "under_review")
    .reduce((sum, d) => sum + d.amountRequested, 0);
  const fundingLedgerStatus = selectedLoan && draws
    ? getFundingLedgerStatus({
        savedDrawFundsUsed: selectedLoan.drawFundsUsed,
        draws,
      })
    : undefined;
  const available = selectedLoan?.drawFundsTotal !== undefined && fundingLedgerStatus?.isReconciled
    ? selectedLoan.drawFundsTotal - fundingLedgerStatus.recordedTotal - pendingTotal
    : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan || !amount || !description.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    if (fundingLedgerStatus?.isReconciled === false) {
      toast.error("Draw requests are temporarily unavailable. Contact your lending team.");
      return;
    }
    const requestedAmount = Number(amount);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      toast.error("Draw amount must be greater than 0");
      return;
    }
    if (available !== undefined && requestedAmount > available) {
      toast.error(`Amount exceeds available funds (${formatCurrency(available)})`);
      return;
    }

    setSaving(true);
    try {
      await submitDraw({
        loanId: selectedLoan._id,
        amountRequested: requestedAmount,
        workDescription: description,
      });
      router.push("/dashboard/borrower/draws");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to submit draw request"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
        <Link
          href="/dashboard/borrower/draws"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <PageHeader
          title="New Draw Request"
          description="Request a draw disbursement on an eligible loan"
        />
      </div>

      {drawEligibleLoans.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            Eligible loans must be approved, funded, sent to title, or closed with funds still outstanding.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Select Loan <span className="text-red-500">*</span>
                </label>
                <select
                  value={loanId}
                  onChange={(e) => setLoanId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                >
                  <option value="">Choose a loan...</option>
                  {drawEligibleLoans.map((loan) => (
                    <option key={loan._id} value={loan._id}>
                      {loan.propertyAddress} — {formatCurrency(loan.loanAmount)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedLoan && selectedLoan.drawFundsTotal !== undefined && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Total Draw Funds
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(selectedLoan.drawFundsTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">Used</span>
                    <span className="font-medium tabular-nums">
                      {fundingLedgerStatus === undefined
                        ? "Loading..."
                        : fundingLedgerStatus.isReconciled
                          ? formatCurrency(fundingLedgerStatus.recordedTotal)
                          : "Unavailable"}
                    </span>
                  </div>
                  {pendingTotal > 0 && (
                    <div className="flex justify-between mt-1">
                      <span className="text-muted-foreground">Pending</span>
                      <span className="font-medium text-amber-600 tabular-nums">
                        {formatCurrency(pendingTotal)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between mt-1 border-t border-border pt-1">
                    <span className="text-muted-foreground font-medium">
                      Available
                    </span>
                    <span className="font-semibold text-primary tabular-nums">
                      {fundingLedgerStatus === undefined
                        ? "Loading..."
                        : fundingLedgerStatus.isReconciled
                          ? formatCurrency(available ?? 0)
                          : "Unavailable"}
                    </span>
                  </div>
                  {fundingLedgerStatus?.isReconciled === false && (
                    <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 text-pretty dark:text-amber-200">
                      Draw requests are temporarily unavailable. Contact your lending team.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Amount Requested <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Work Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Describe the work completed..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/dashboard/borrower/draws"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || !fundingLedgerStatus?.isReconciled}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              Submit Draw Request
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
