"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/dashboard/page-header";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function NewLoanPage() {
  const createLoan = useMutation(api.admin.createLoan);
  const borrowers = useQuery(api.users.getAllBorrowers);
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    borrowerId: "",
    borrowerName: "",
    entityName: "",
    propertyAddress: "",
    purchasePrice: "",
    loanAmount: "",
    afterRepairValue: "",
    rehabBudgetTotal: "",
    closeDate: "",
    maturityDate: "",
    terms: "",
    interestRate: "",
    monthlyPayment: "",
    paymentDueDay: "",
    pointsEarned: "",
    monthlyInterestEarned: "",
    status: "submitted" as const,
    titleCompany: "",
    titleCompanyContact: "",
    drawFundsTotal: "",
    drawFundsUsed: "",
    notes: "",
  });

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleBorrowerSelect = (borrowerId: string) => {
    const borrower = borrowers?.find((b) => b._id === borrowerId);
    if (borrower) {
      setForm((prev) => ({
        ...prev,
        borrowerId: borrower._id,
        borrowerName: borrower.displayName,
        entityName: borrower.company ?? "",
      }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.borrowerId) {
      setError("Please select a borrower");
      return;
    }
    if (!form.propertyAddress) {
      setError("Property address is required");
      return;
    }
    if (!form.loanAmount || Number(form.loanAmount) <= 0) {
      setError("Valid loan amount is required");
      return;
    }
    if (Number(form.purchasePrice) < 0) {
      setError("Purchase price cannot be negative");
      return;
    }
    if (Number(form.interestRate) < 0) {
      setError("Interest rate cannot be negative");
      return;
    }
    if (Number(form.monthlyPayment) < 0) {
      setError("Monthly payment cannot be negative");
      return;
    }
    if (Number(form.pointsEarned) < 0) {
      setError("Points earned cannot be negative");
      return;
    }
    if (form.paymentDueDay && (Number(form.paymentDueDay) < 1 || Number(form.paymentDueDay) > 31)) {
      setError("Payment due day must be between 1 and 31");
      return;
    }

    setSubmitting(true);
    try {
      const id = await createLoan({
        borrowerId: form.borrowerId as Id<"userProfiles">,
        borrowerName: form.borrowerName,
        entityName: form.entityName,
        propertyAddress: form.propertyAddress,
        purchasePrice: Number(form.purchasePrice) || 0,
        loanAmount: Number(form.loanAmount),
        afterRepairValue: form.afterRepairValue
          ? Number(form.afterRepairValue)
          : undefined,
        rehabBudgetTotal: form.rehabBudgetTotal
          ? Number(form.rehabBudgetTotal)
          : undefined,
        closeDate: form.closeDate || undefined,
        maturityDate: form.maturityDate || undefined,
        terms: form.terms || "N/A",
        interestRate: Number(form.interestRate) || 0,
        monthlyPayment: Number(form.monthlyPayment) || 0,
        paymentDueDay: form.paymentDueDay
          ? Number(form.paymentDueDay)
          : undefined,
        pointsEarned: Number(form.pointsEarned) || 0,
        monthlyInterestEarned: form.monthlyInterestEarned
          ? Number(form.monthlyInterestEarned)
          : undefined,
        status: form.status,
        titleCompany: form.titleCompany || undefined,
        titleCompanyContact: form.titleCompanyContact || undefined,
        drawFundsTotal: form.drawFundsTotal
          ? Number(form.drawFundsTotal)
          : undefined,
        drawFundsUsed: form.drawFundsUsed
          ? Number(form.drawFundsUsed)
          : undefined,
        notes: form.notes || undefined,
      });
      router.push(`/dashboard/admin/loans/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create loan");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30";
  const labelClass = "block text-sm font-medium text-muted-foreground mb-1.5";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/admin/loans"
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <PageHeader title="New Loan" description="Create a new loan record" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Borrower Info */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-base font-semibold">Borrower Information</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>Select Borrower</label>
              <select
                value={form.borrowerId}
                onChange={(e) => handleBorrowerSelect(e.target.value)}
                className={inputClass}
              >
                <option value="">— Select a borrower —</option>
                {(borrowers ?? []).map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.displayName}
                    {b.company ? ` (${b.company})` : ""} — {b.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Borrower Name</label>
              <input
                className={inputClass}
                value={form.borrowerName}
                onChange={(e) => update("borrowerName", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Entity / LLC</label>
              <input
                className={inputClass}
                value={form.entityName}
                onChange={(e) => update("entityName", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Property Details */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-base font-semibold">Property Details</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>Property Address</label>
              <input
                className={inputClass}
                value={form.propertyAddress}
                onChange={(e) => update("propertyAddress", e.target.value)}
                placeholder="123 Main St, City, State ZIP"
              />
            </div>
            <div>
              <label className={labelClass}>Purchase Price</label>
              <input
                className={inputClass}
                type="number"
                value={form.purchasePrice}
                onChange={(e) => update("purchasePrice", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelClass}>After Repair Value (ARV)</label>
              <input
                className={inputClass}
                type="number"
                value={form.afterRepairValue}
                onChange={(e) => update("afterRepairValue", e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
        </div>

        {/* Loan Terms */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-base font-semibold">Loan Terms</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={labelClass}>Loan Amount</label>
              <input
                className={inputClass}
                type="number"
                value={form.loanAmount}
                onChange={(e) => update("loanAmount", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelClass}>Terms</label>
              <input
                className={inputClass}
                value={form.terms}
                onChange={(e) => update("terms", e.target.value)}
                placeholder='e.g. "3/13"'
              />
            </div>
            <div>
              <label className={labelClass}>Interest Rate (%)</label>
              <input
                className={inputClass}
                type="number"
                step="0.01"
                value={form.interestRate}
                onChange={(e) => update("interestRate", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelClass}>Monthly Payment</label>
              <input
                className={inputClass}
                type="number"
                value={form.monthlyPayment}
                onChange={(e) => update("monthlyPayment", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelClass}>Payment Due Day</label>
              <input
                className={inputClass}
                type="number"
                min="1"
                max="31"
                value={form.paymentDueDay}
                onChange={(e) => update("paymentDueDay", e.target.value)}
                placeholder="1-31"
              />
            </div>
            <div>
              <label className={labelClass}>Points Earned</label>
              <input
                className={inputClass}
                type="number"
                value={form.pointsEarned}
                onChange={(e) => update("pointsEarned", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelClass}>Monthly Interest Earned</label>
              <input
                className={inputClass}
                type="number"
                value={form.monthlyInterestEarned}
                onChange={(e) => update("monthlyInterestEarned", e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className={labelClass}>Rehab Budget Total</label>
              <input
                className={inputClass}
                type="number"
                value={form.rehabBudgetTotal}
                onChange={(e) => update("rehabBudgetTotal", e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) => update("status", e.target.value)}
              >
                <option value="submitted">Submitted</option>
                <option value="under_review">Under Review</option>
                <option value="additional_info_needed">Info Needed</option>
                <option value="approved">Approved</option>
                <option value="funded">Funded</option>
                <option value="sent_to_title">Sent to Title</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Dates & Title */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-base font-semibold">
            Dates & Title Company
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Close Date</label>
              <input
                className={inputClass}
                value={form.closeDate}
                onChange={(e) => update("closeDate", e.target.value)}
                placeholder="MM/DD/YYYY"
              />
            </div>
            <div>
              <label className={labelClass}>Maturity Date</label>
              <input
                className={inputClass}
                value={form.maturityDate}
                onChange={(e) => update("maturityDate", e.target.value)}
                placeholder="MM/DD/YYYY"
              />
            </div>
            <div>
              <label className={labelClass}>Title Company</label>
              <input
                className={inputClass}
                value={form.titleCompany}
                onChange={(e) => update("titleCompany", e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className={labelClass}>Title Company Contact</label>
              <input
                className={inputClass}
                value={form.titleCompanyContact}
                onChange={(e) => update("titleCompanyContact", e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
        </div>

        {/* Draw Funds */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-base font-semibold">Draw Funds</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Draw Funds Total</label>
              <input
                className={inputClass}
                type="number"
                value={form.drawFundsTotal}
                onChange={(e) => update("drawFundsTotal", e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className={labelClass}>Draw Funds Used</label>
              <input
                className={inputClass}
                type="number"
                value={form.drawFundsUsed}
                onChange={(e) => update("drawFundsUsed", e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-base font-semibold">Notes</h3>
          <textarea
            className={inputClass}
            rows={4}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Additional notes about this loan..."
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Link
            href="/dashboard/admin/loans"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Create Loan
          </button>
        </div>
      </form>
    </div>
  );
}
