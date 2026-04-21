"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { FileUploadDialog } from "@/components/dashboard/file-upload-dialog";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { RehabBudgetEditor } from "@/components/dashboard/rehab-budget-editor";
import { PropertyComps } from "@/components/dashboard/property-comps";
import {
  Loader2,
  ArrowLeft,
  Pencil,
  Save,
  X,
  Upload,
  Download,
  FileText,
  Trash2,
  ChevronUp,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { DetailPageSkeleton } from "@/components/dashboard/skeleton";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";

const STATUSES = [
  "submitted",
  "under_review",
  "additional_info_needed",
  "approved",
  "denied",
  "funded",
  "sent_to_title",
  "closed",
] as const;

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | number | undefined | null;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
      <span className="text-sm font-medium text-muted-foreground sm:w-48 sm:shrink-0">
        {label}
      </span>
      <span className="text-sm">{value ?? "—"}</span>
    </div>
  );
}

export default function LoanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as Id<"loans">;
  const loan = useQuery(api.admin.getLoan, { id });
  const drawRequests = useQuery(api.draws.getDrawRequestsForLoan, { loanId: id });
  const documents = useQuery(api.documents.getDocumentsForLoan, { loanId: id });
  const closingStatementUrl = useQuery(api.admin.getClosingStatementUrl, { loanId: id });
  const payments = useQuery(api.loanPayments.getPaymentsForLoan, { loanId: id });
  const updateStatus = useMutation(api.admin.updateLoanStatus);
  const updateLoan = useMutation(api.admin.updateLoan);
  const attachClosingStatement = useMutation(api.admin.attachClosingStatement);
  const removeClosingStatement = useMutation(api.admin.removeClosingStatement);
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const recordPayment = useMutation(api.loanPayments.recordPayment);
  const deletePayment = useMutation(api.loanPayments.deletePayment);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [uploadOpen, setUploadOpen] = useState(false);
  const [closingUploading, setClosingUploading] = useState(false);
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [confirmDeletePayment, setConfirmDeletePayment] = useState<string | null>(null);
  const [confirmRemoveClosing, setConfirmRemoveClosing] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState(false);
  const [removingClosing, setRemovingClosing] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: "",
    paymentDate: "",
    dueDate: "",
    method: "ach" as "ach" | "wire" | "check" | "other",
    status: "on_time" as "on_time" | "late" | "partial" | "missed",
    notes: "",
  });

  const loanDraws = drawRequests ?? [];

  // Compute payment stats client-side from payments data (avoids duplicate query)
  const paymentStats = payments && payments.length > 0 ? (() => {
    const totalReceived = payments.filter((p) => p.status !== "missed").reduce((sum, p) => sum + p.amount, 0);
    const paymentCount = payments.length;
    const onTimeCount = payments.filter((p) => p.status === "on_time").length;
    const lateCount = payments.filter((p) => p.status === "late").length;
    const missedCount = payments.filter((p) => p.status === "missed").length;
    const partialCount = payments.filter((p) => p.status === "partial").length;
    return { totalReceived, paymentCount, onTimeCount, lateCount, missedCount, partialCount };
  })() : null;

  if (loan === undefined) {
    return <DetailPageSkeleton />;
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateStatus({
        id,
        status: newStatus as (typeof STATUSES)[number],
      });
      toast.success("Status updated");
    } catch {
      toast.error("Failed to update status");
    }
  };

  const startEditing = () => {
    setEditing(true);
    setEditData({
      borrowerName: loan.borrowerName,
      entityName: loan.entityName,
      propertyAddress: loan.propertyAddress,
      purchasePrice: String(loan.purchasePrice),
      loanAmount: String(loan.loanAmount),
      afterRepairValue: loan.afterRepairValue ? String(loan.afterRepairValue) : "",
      rehabBudgetTotal: loan.rehabBudgetTotal ? String(loan.rehabBudgetTotal) : "",
      terms: loan.terms,
      interestRate: String(loan.interestRate),
      monthlyPayment: String(loan.monthlyPayment),
      pointsEarned: String(loan.pointsEarned),
      monthlyInterestEarned: loan.monthlyInterestEarned ? String(loan.monthlyInterestEarned) : "",
      closeDate: loan.closeDate ?? "",
      maturityDate: loan.maturityDate ?? "",
      titleCompany: loan.titleCompany ?? "",
      titleCompanyContact: loan.titleCompanyContact ?? "",
      notes: loan.notes ?? "",
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateLoan({
        id,
        borrowerName: editData.borrowerName,
        entityName: editData.entityName,
        propertyAddress: editData.propertyAddress,
        purchasePrice: Number(editData.purchasePrice),
        loanAmount: Number(editData.loanAmount),
        afterRepairValue: editData.afterRepairValue ? Number(editData.afterRepairValue) : undefined,
        rehabBudgetTotal: editData.rehabBudgetTotal ? Number(editData.rehabBudgetTotal) : undefined,
        terms: editData.terms,
        interestRate: Number(editData.interestRate),
        monthlyPayment: Number(editData.monthlyPayment),
        pointsEarned: Number(editData.pointsEarned),
        monthlyInterestEarned: editData.monthlyInterestEarned ? Number(editData.monthlyInterestEarned) : undefined,
        closeDate: editData.closeDate || undefined,
        maturityDate: editData.maturityDate || undefined,
        titleCompany: editData.titleCompany || undefined,
        titleCompanyContact: editData.titleCompanyContact || undefined,
        notes: editData.notes || undefined,
      });
      setEditing(false);
      toast.success("Loan saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save loan");
    } finally {
      setSaving(false);
    }
  };

  const handleClosingStatementUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only PDF and image files (PNG, JPEG, WebP) are allowed.");
      e.target.value = "";
      return;
    }
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error("File size must be under 10MB.");
      e.target.value = "";
      return;
    }

    setClosingUploading(true);
    try {
      const url = await generateUploadUrl();
      const result = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) throw new Error("Upload failed: " + result.statusText);
      const { storageId } = await result.json();
      await attachClosingStatement({ loanId: id, fileId: storageId });
      toast.success("Closing statement uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload closing statement");
    } finally {
      setClosingUploading(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentData.amount || !paymentData.paymentDate || !paymentData.dueDate) return;
    setPaymentSaving(true);
    try {
      await recordPayment({
        loanId: id,
        amount: Number(paymentData.amount),
        paymentDate: paymentData.paymentDate,
        dueDate: paymentData.dueDate,
        method: paymentData.method,
        status: paymentData.status,
        notes: paymentData.notes || undefined,
      });
      setPaymentFormOpen(false);
      setPaymentData({
        amount: loan.monthlyPayment ? String(loan.monthlyPayment) : "",
        paymentDate: "",
        dueDate: "",
        method: "ach",
        status: "on_time",
        notes: "",
      });
      toast.success("Payment recorded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setPaymentSaving(false);
    }
  };

  const field = (key: string) => ({
    value: editData[key] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setEditData((prev) => ({ ...prev, [key]: e.target.value })),
    className:
      "w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30",
  });

  const paymentColumns: Column<Record<string, unknown>>[] = [
    { key: "paymentDate", header: "Date" },
    { key: "dueDate", header: "Due Date" },
    {
      key: "amount",
      header: "Amount",
      render: (row) => formatCurrency(row.amount as number),
    },
    {
      key: "method",
      header: "Method",
      render: (row) => <StatusBadge status={row.method as string} />,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status as string} />,
    },
    {
      key: "notes",
      header: "Notes",
      render: (row) => (row.notes as string) || "—",
      className: "hidden md:table-cell",
    },
    {
      key: "_id",
      header: "",
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setConfirmDeletePayment(row._id as string);
          }}
          className="rounded p-1 text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
        >
          <Trash2 className="size-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/admin/loans"
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <PageHeader
          title={loan.propertyAddress}
          description={`${loan.borrowerName} — ${loan.entityName}`}
          actions={
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <button
                    onClick={() => setEditing(false)}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
                  >
                    <X className="size-4" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Save
                  </button>
                </>
              ) : (
                <button
                  onClick={startEditing}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  <Pencil className="size-4" />
                  Edit
                </button>
              )}
            </div>
          }
        />
      </div>

      {/* Status */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">
          Loan Status
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              className={`transition-opacity ${
                loan.status === status ? "opacity-100" : "opacity-40 hover:opacity-70"
              }`}
            >
              <StatusBadge status={status} />
            </button>
          ))}
        </div>
      </div>

      {/* Loan Details */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            Borrower Info
          </h3>
          <div className="space-y-3">
            {editing ? (
              <>
                <div>
                  <label className="text-sm text-muted-foreground">Borrower Name</label>
                  <input {...field("borrowerName")} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Entity</label>
                  <input {...field("entityName")} />
                </div>
              </>
            ) : (
              <>
                <DetailRow label="Borrower" value={loan.borrowerName} />
                <DetailRow label="Entity" value={loan.entityName} />
              </>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            Property Details
          </h3>
          <div className="space-y-3">
            {editing ? (
              <>
                <div>
                  <label className="text-sm text-muted-foreground">Address</label>
                  <input {...field("propertyAddress")} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Purchase Price</label>
                  <input {...field("purchasePrice")} type="number" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">After Repair Value</label>
                  <input {...field("afterRepairValue")} type="number" />
                </div>
              </>
            ) : (
              <>
                <DetailRow label="Address" value={loan.propertyAddress} />
                <DetailRow label="Purchase Price" value={formatCurrency(loan.purchasePrice)} />
                <DetailRow
                  label="After Repair Value"
                  value={loan.afterRepairValue ? formatCurrency(loan.afterRepairValue) : undefined}
                />
              </>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            Loan Terms
          </h3>
          <div className="space-y-3">
            {editing ? (
              <>
                <div>
                  <label className="text-sm text-muted-foreground">Loan Amount</label>
                  <input {...field("loanAmount")} type="number" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Terms</label>
                  <input {...field("terms")} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Interest Rate (%)</label>
                  <input {...field("interestRate")} type="number" step="0.01" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Monthly Payment</label>
                  <input {...field("monthlyPayment")} type="number" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Points Earned</label>
                  <input {...field("pointsEarned")} type="number" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Monthly Interest Earned</label>
                  <input {...field("monthlyInterestEarned")} type="number" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Rehab Budget Total</label>
                  <input {...field("rehabBudgetTotal")} type="number" />
                </div>
              </>
            ) : (
              <>
                <DetailRow label="Loan Amount" value={formatCurrency(loan.loanAmount)} />
                <DetailRow label="Terms" value={loan.terms} />
                <DetailRow label="Interest Rate" value={`${loan.interestRate}%`} />
                <DetailRow label="Monthly Payment" value={formatCurrency(loan.monthlyPayment)} />
                <DetailRow label="Points Earned" value={formatCurrency(loan.pointsEarned)} />
                <DetailRow
                  label="Monthly Interest"
                  value={loan.monthlyInterestEarned ? formatCurrency(loan.monthlyInterestEarned) : undefined}
                />
                <DetailRow
                  label="Rehab Budget"
                  value={loan.rehabBudgetTotal ? formatCurrency(loan.rehabBudgetTotal) : undefined}
                />
              </>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            Dates & Title
          </h3>
          <div className="space-y-3">
            {editing ? (
              <>
                <div>
                  <label className="text-sm text-muted-foreground">Close Date</label>
                  <input {...field("closeDate")} placeholder="MM/DD/YYYY" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Maturity Date</label>
                  <input {...field("maturityDate")} placeholder="MM/DD/YYYY" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Title Company</label>
                  <input {...field("titleCompany")} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Title Contact</label>
                  <input {...field("titleCompanyContact")} />
                </div>
              </>
            ) : (
              <>
                <DetailRow label="Close Date" value={loan.closeDate} />
                <DetailRow label="Maturity Date" value={loan.maturityDate} />
                <DetailRow label="Title Company" value={loan.titleCompany} />
                <DetailRow label="Title Contact" value={loan.titleCompanyContact} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Closing Statement */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">
          Closing Statement
        </h3>
        {closingStatementUrl ? (
          <div className="flex items-center gap-3">
            <a
              href={closingStatementUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <FileText className="size-4" />
              View Closing Statement
            </a>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
              {closingUploading ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
              Replace
              <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={handleClosingStatementUpload} />
            </label>
            <button
              onClick={() => {
                setConfirmRemoveClosing(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="size-3" />
              Remove
            </button>
          </div>
        ) : (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80">
            {closingUploading ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
            Attach Closing Statement
            <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={handleClosingStatementUpload} />
          </label>
        )}
      </div>

      {/* Notes */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">
          Notes
        </h3>
        {editing ? (
          <textarea
            {...field("notes")}
            rows={4}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        ) : (
          <p className="text-sm whitespace-pre-wrap">{loan.notes || "No notes"}</p>
        )}
      </div>

      {/* Property Comps */}
      <PropertyComps loanId={id} />

      {/* Rehab Budget */}
      <RehabBudgetEditor loanId={id} />

      {/* Payment History */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Payment History
          </h3>
          {["funded", "closed", "sent_to_title"].includes(loan.status) && (
            <button
              onClick={() => {
                setPaymentFormOpen((v) => !v);
                if (!paymentFormOpen) {
                  setPaymentData((prev) => ({
                    ...prev,
                    amount: loan.monthlyPayment ? String(loan.monthlyPayment) : "",
                  }));
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80"
            >
              {paymentFormOpen ? <ChevronUp className="size-3" /> : <Plus className="size-3" />}
              Record Payment
            </button>
          )}
        </div>

        {/* Payment Stats */}
        {paymentStats && (
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Total Received</p>
              <p className="text-sm font-semibold">{formatCurrency(paymentStats.totalReceived)}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Payments</p>
              <p className="text-sm font-semibold">{paymentStats.paymentCount}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">On Time</p>
              <p className="text-sm font-semibold text-green-600">
                {Math.round((paymentStats.onTimeCount / paymentStats.paymentCount) * 100)}%
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Late</p>
              <p className="text-sm font-semibold text-amber-600">{paymentStats.lateCount}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Partial</p>
              <p className="text-sm font-semibold text-orange-600">{paymentStats.partialCount}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Missed</p>
              <p className="text-sm font-semibold text-red-600">{paymentStats.missedCount}</p>
            </div>
          </div>
        )}

        {/* Record Payment Form */}
        {paymentFormOpen && (
          <div className="mb-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Amount</label>
                <input
                  type="number"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData((p) => ({ ...p, amount: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Payment Date</label>
                <input
                  value={paymentData.paymentDate}
                  onChange={(e) => setPaymentData((p) => ({ ...p, paymentDate: e.target.value }))}
                  placeholder="MM/DD/YYYY"
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Due Date</label>
                <input
                  value={paymentData.dueDate}
                  onChange={(e) => setPaymentData((p) => ({ ...p, dueDate: e.target.value }))}
                  placeholder="MM/DD/YYYY"
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Method</label>
                <select
                  value={paymentData.method}
                  onChange={(e) => setPaymentData((p) => ({ ...p, method: e.target.value as typeof p.method }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                >
                  <option value="ach">ACH</option>
                  <option value="wire">Wire</option>
                  <option value="check">Check</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
                <select
                  value={paymentData.status}
                  onChange={(e) => setPaymentData((p) => ({ ...p, status: e.target.value as typeof p.status }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                >
                  <option value="on_time">On Time</option>
                  <option value="late">Late</option>
                  <option value="partial">Partial</option>
                  <option value="missed">Missed</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes</label>
                <input
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setPaymentFormOpen(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                disabled={paymentSaving}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
              >
                {paymentSaving && <Loader2 className="size-3 animate-spin" />}
                Save Payment
              </button>
            </div>
          </div>
        )}

        {payments && payments.length > 0 ? (
          <DataTable
            data={payments as unknown as Record<string, unknown>[]}
            columns={paymentColumns}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No payments recorded yet</p>
        )}
      </div>

      {/* Documents & Draw Requests */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">
              Documents
            </h3>
            <button
              onClick={() => setUploadOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80"
            >
              <Upload className="size-3" />
              Upload
            </button>
          </div>
          {documents && documents.length > 0 ? (
            <div className="divide-y divide-border">
              {documents.map((doc) => (
                <div
                  key={doc._id}
                  className="flex items-center justify-between py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{doc.fileName}</p>
                    <StatusBadge status={doc.type} />
                  </div>
                  {doc.url && (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Download className="size-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No documents yet</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            Draw Requests ({loanDraws.length})
          </h3>
          {loanDraws.length > 0 ? (
            <div className="divide-y divide-border">
              {loanDraws.map((draw) => (
                <button
                  key={draw._id}
                  onClick={() => router.push(`/dashboard/admin/draws/${draw._id}`)}
                  className="flex w-full items-center justify-between py-2 text-left hover:bg-muted/50 rounded px-1 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {formatCurrency(draw.amountRequested)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {draw.workDescription}
                    </p>
                  </div>
                  <StatusBadge status={draw.status} />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No draw requests yet
            </p>
          )}
        </div>
      </div>

      <FileUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        loanId={id}
      />
      <ConfirmDialog
        open={confirmDeletePayment !== null}
        title="Delete this payment?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        loading={deletingPayment}
        onConfirm={async () => {
          if (!confirmDeletePayment) return;
          setDeletingPayment(true);
          try {
            await deletePayment({ id: confirmDeletePayment as Id<"loanPayments"> });
            toast.success("Payment deleted");
            setConfirmDeletePayment(null);
          } catch {
            toast.error("Failed to delete payment");
          } finally {
            setDeletingPayment(false);
          }
        }}
        onCancel={() => setConfirmDeletePayment(null)}
      />
      <ConfirmDialog
        open={confirmRemoveClosing}
        title="Remove closing statement?"
        description="This will remove the attached closing statement file."
        confirmLabel="Remove"
        variant="destructive"
        loading={removingClosing}
        onConfirm={async () => {
          setRemovingClosing(true);
          try {
            await removeClosingStatement({ loanId: id });
            toast.success("Closing statement removed");
            setConfirmRemoveClosing(false);
          } catch {
            toast.error("Failed to remove closing statement");
          } finally {
            setRemovingClosing(false);
          }
        }}
        onCancel={() => setConfirmRemoveClosing(false)}
      />
    </div>
  );
}
