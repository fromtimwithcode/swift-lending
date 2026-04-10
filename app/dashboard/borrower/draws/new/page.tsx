"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/dashboard/page-header";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function formatCurrency(value: number): string {
  return "$" + value.toLocaleString();
}

export default function NewDrawRequestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedLoanId = searchParams.get("loanId");

  const loans = useQuery(api.borrower.getMyLoans);
  const submitDraw = useMutation(api.borrower.submitDrawRequest);

  const [loanId, setLoanId] = useState(preselectedLoanId ?? "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (loans === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const fundedLoans = loans.filter((l) => l.status === "funded");
  const selectedLoan = fundedLoans.find((l) => l._id === loanId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanId || !amount || !description) {
      setError("Please fill in all fields.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await submitDraw({
        loanId: loanId as Id<"loans">,
        amountRequested: Number(amount),
        workDescription: description,
      });
      router.push("/dashboard/borrower/draws");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/borrower/draws"
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <PageHeader
          title="New Draw Request"
          description="Request a draw disbursement on a funded loan"
        />
      </div>

      {fundedLoans.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            You don&apos;t have any funded loans. Draw requests can only be
            submitted on funded loans.
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
                  {fundedLoans.map((loan) => (
                    <option key={loan._id} value={loan._id}>
                      {loan.propertyAddress} — {formatCurrency(loan.loanAmount)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedLoan && selectedLoan.drawFundsTotal && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Total Draw Funds
                    </span>
                    <span className="font-medium">
                      {formatCurrency(selectedLoan.drawFundsTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">Used</span>
                    <span className="font-medium">
                      {formatCurrency(selectedLoan.drawFundsUsed ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between mt-1 border-t border-border pt-1">
                    <span className="text-muted-foreground font-medium">
                      Remaining
                    </span>
                    <span className="font-semibold text-primary">
                      {formatCurrency(
                        selectedLoan.drawFundsTotal -
                          (selectedLoan.drawFundsUsed ?? 0)
                      )}
                    </span>
                  </div>
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

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-3">
            <Link
              href="/dashboard/borrower/draws"
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
              Submit Draw Request
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
