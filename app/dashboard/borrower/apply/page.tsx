"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoanApplicationPage() {
  const router = useRouter();
  const submitApplication = useMutation(api.borrower.submitApplication);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    entityName: "",
    propertyAddress: "",
    purchasePrice: "",
    loanAmount: "",
    afterRepairValue: "",
    rehabBudgetTotal: "",
    terms: "12 months",
    notes: "",
  });

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const field = (key: string, opts?: { type?: string; placeholder?: string }) => ({
    value: form[key as keyof typeof form],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      update(key, e.target.value),
    type: opts?.type,
    placeholder: opts?.placeholder,
    className:
      "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.entityName || !form.propertyAddress || !form.purchasePrice || !form.loanAmount) {
      setError("Please fill in all required fields.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const loanId = await submitApplication({
        entityName: form.entityName,
        propertyAddress: form.propertyAddress,
        purchasePrice: Number(form.purchasePrice),
        loanAmount: Number(form.loanAmount),
        afterRepairValue: form.afterRepairValue ? Number(form.afterRepairValue) : undefined,
        rehabBudgetTotal: form.rehabBudgetTotal ? Number(form.rehabBudgetTotal) : undefined,
        terms: form.terms,
        notes: form.notes || undefined,
      });
      router.push(`/dashboard/borrower/loans/${loanId}`);
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
          href="/dashboard/borrower"
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <PageHeader
          title="Apply for a Loan"
          description="Submit a new loan application"
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Entity Info */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            Entity Information
          </h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Entity / LLC Name <span className="text-red-500">*</span>
              </label>
              <input {...field("entityName", { placeholder: "e.g. My LLC" })} />
            </div>
          </div>
        </div>

        {/* Property Details */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            Property Details
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">
                Property Address <span className="text-red-500">*</span>
              </label>
              <input
                {...field("propertyAddress", {
                  placeholder: "123 Main St, City, State ZIP",
                })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Purchase Price <span className="text-red-500">*</span>
              </label>
              <input
                {...field("purchasePrice", { type: "number", placeholder: "0" })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                After Repair Value (ARV)
              </label>
              <input
                {...field("afterRepairValue", { type: "number", placeholder: "0" })}
              />
            </div>
          </div>
        </div>

        {/* Loan Request */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            Loan Request
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Loan Amount Requested <span className="text-red-500">*</span>
              </label>
              <input
                {...field("loanAmount", { type: "number", placeholder: "0" })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Rehab Budget
              </label>
              <input
                {...field("rehabBudgetTotal", { type: "number", placeholder: "0" })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Desired Terms
              </label>
              <select {...field("terms")}>
                <option value="6 months">6 months</option>
                <option value="9 months">9 months</option>
                <option value="12 months">12 months</option>
                <option value="18 months">18 months</option>
                <option value="24 months">24 months</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            Additional Notes
          </h3>
          <textarea
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={4}
            placeholder="Anything else you'd like us to know..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        <div className="flex justify-end gap-3">
          <Link
            href="/dashboard/borrower"
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
            Submit Application
          </button>
        </div>
      </form>
    </div>
  );
}
