"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import { isDrawEligibleLoanStatus } from "@/convex/lib/constants";
import { DetailPageSkeleton } from "@/components/dashboard/skeleton";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";

export default function NewAdminDrawRequestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedLoanId = searchParams.get("loanId");

  const [loanId, setLoanId] = useState(preselectedLoanId ?? "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const loans = useQuery(api.admin.getLoans, {});
  const drawEligibleLoans = loans?.filter((loan) => isDrawEligibleLoanStatus(loan.status)) ?? [];
  const selectedLoan = drawEligibleLoans.find((loan) => loan._id === loanId);
  const draws = useQuery(
    api.draws.getDrawRequestsForLoan,
    selectedLoan ? { loanId: selectedLoan._id } : "skip"
  );
  const createDraw = useMutation(api.draws.createManualDrawRequest);

  if (loans === undefined) {
    return <DetailPageSkeleton />;
  }

  const pendingTotal = (draws ?? [])
    .filter((draw) => draw.status === "pending" || draw.status === "under_review")
    .reduce((sum, draw) => sum + draw.amountRequested, 0);
  const available = selectedLoan?.drawFundsTotal !== undefined
    ? selectedLoan.drawFundsTotal - (selectedLoan.drawFundsUsed ?? 0) - pendingTotal
    : undefined;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedLoan || !amount || !description.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    const requestedAmount = Number(amount);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      toast.error("Draw amount must be greater than 0");
      return;
    }
    if (available !== undefined && requestedAmount > available) {
      toast.error(`Amount exceeds available funds (${formatCurrency(Math.max(0, available))})`);
      return;
    }

    setSaving(true);
    try {
      const drawId = await createDraw({
        loanId: selectedLoan._id,
        amountRequested: requestedAmount,
        workDescription: description,
      });
      toast.success("Draw request created");
      router.push(`/dashboard/admin/draws/${drawId}`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to create draw request"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/admin/draws"
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <PageHeader
          title="New Draw Request"
          description="Manually create a pending draw request for an active loan"
        />
      </div>

      {drawEligibleLoans.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            There are no loans eligible for draw requests.
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
                  onChange={(event) => setLoanId(event.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                >
                  <option value="">Choose a loan...</option>
                  {drawEligibleLoans.map((loan) => (
                    <option key={loan._id} value={loan._id}>
                      {loan.propertyAddress} - {loan.borrowerName} - {formatCurrency(loan.loanAmount)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedLoan && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Borrower</span>
                    <span className="text-right font-medium">{selectedLoan.borrowerName}</span>
                  </div>
                  {selectedLoan.drawFundsTotal !== undefined ? (
                    <>
                      <div className="mt-1 flex justify-between gap-4">
                        <span className="text-muted-foreground">Total Draw Funds</span>
                        <span className="font-medium tabular-nums">
                          {formatCurrency(selectedLoan.drawFundsTotal)}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between gap-4">
                        <span className="text-muted-foreground">Used</span>
                        <span className="font-medium tabular-nums">
                          {formatCurrency(selectedLoan.drawFundsUsed ?? 0)}
                        </span>
                      </div>
                      {pendingTotal > 0 && (
                        <div className="mt-1 flex justify-between gap-4">
                          <span className="text-muted-foreground">Pending</span>
                          <span className="font-medium text-amber-600 tabular-nums">
                            {formatCurrency(pendingTotal)}
                          </span>
                        </div>
                      )}
                      <div className="mt-1 flex justify-between gap-4 border-t border-border pt-1">
                        <span className="font-medium text-muted-foreground">Available</span>
                        <span className="font-semibold text-primary tabular-nums">
                          {formatCurrency(Math.max(0, available ?? 0))}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      No draw fund limit is configured for this loan.
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
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Work Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  placeholder="Describe the work completed or draw purpose..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Link
              href="/dashboard/admin/draws"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              Create Draw Request
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
