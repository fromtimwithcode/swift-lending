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
  FileText,
  Trash2,
  ChevronUp,
  Plus,
  RotateCcw,
} from "lucide-react";
import { AddressInput } from "@/components/dashboard/address-input";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { formatCurrency, formatFileSize } from "@/lib/format";
import { formatUsDate, getSixMonthMaturityDate, parseUsDate } from "@/lib/dates";
import { calculatePayoffEstimate, calculatePoints } from "@/lib/loan-calc";
import { calculateMonthlyInterest, getCurrentPrincipalOut } from "@/convex/lib/loanCalculations";
import { PAYMENT_TYPE_LABELS, STRATEGY_LABELS, MAX_FILE_SIZE_BYTES, DEFAULT_POINTS_PERCENTAGE } from "@/convex/lib/constants";
import { DetailPageSkeleton } from "@/components/dashboard/skeleton";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { DocumentPreviewRow } from "@/components/dashboard/document-preview-row";
import { DatePickerField } from "@/components/dashboard/date-picker-field";

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

const VALID_STATUS_TRANSITIONS: Record<(typeof STATUSES)[number], (typeof STATUSES)[number][]> = {
  submitted: ["under_review", "additional_info_needed", "denied", "closed"],
  under_review: ["approved", "additional_info_needed", "denied", "closed"],
  additional_info_needed: ["under_review", "denied", "closed"],
  approved: ["funded", "denied", "closed"],
  funded: ["sent_to_title", "closed"],
  sent_to_title: ["closed"],
  denied: ["under_review", "approved", "closed"],
  closed: [],
};

function canChangeLoanStatus(
  currentStatus: (typeof STATUSES)[number],
  nextStatus: (typeof STATUSES)[number]
) {
  return currentStatus === nextStatus || VALID_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
}

type TitleContactOption = {
  titleCompany: string;
  titleCompanyContact?: string;
};

function getLoanAmountFromPurchaseAndRehab(purchasePrice: string, rehabBudgetTotal: string) {
  return (Number(purchasePrice) || 0) + (Number(rehabBudgetTotal) || 0);
}

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
  const charges = useQuery(api.loanCharges.getChargesForLoan, { loanId: id });
  const borrowers = useQuery(api.users.getAllBorrowers);
  const updateStatus = useMutation(api.admin.updateLoanStatus);
  const updateLoan = useMutation(api.admin.updateLoan);
  const attachClosingStatement = useMutation(api.admin.attachClosingStatement);
  const removeClosingStatement = useMutation(api.admin.removeClosingStatement);
  const recordLoanReturned = useMutation(api.admin.recordLoanReturned);
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
  const [returnFormOpen, setReturnFormOpen] = useState(false);
  const [returnSaving, setReturnSaving] = useState(false);
  const [returnData, setReturnData] = useState({
    returnedDate: formatUsDate(new Date()),
    notes: "",
  });
  const [paymentData, setPaymentData] = useState({
    chargeId: "",
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

  const selectedBorrower = borrowers?.find((b) => b._id === loan.borrowerId);
  const titleContacts = (selectedBorrower?.titleContacts ?? []) as TitleContactOption[];
  const currentPrincipalOut = getCurrentPrincipalOut(loan);
  const currentMonthlyPayment = calculateMonthlyInterest(currentPrincipalOut, loan.interestRate);
  const canRecordReturned = !loan.returnedDate && ["funded", "sent_to_title", "closed"].includes(loan.status);
  const scheduledCharges = [...(charges ?? [])]
    .filter((charge) => charge.status === "scheduled")
    .sort((a, b) => {
      const aTime = parseUsDate(a.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTime = parseUsDate(b.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
  const nextScheduledCharge = scheduledCharges[0];

  const getDefaultPaymentStatus = (dueDate: string) => {
    const parsedDueDate = parseUsDate(dueDate);
    if (!parsedDueDate) return "on_time" as const;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return parsedDueDate < today ? "late" as const : "on_time" as const;
  };

  const openPaymentFormForCharge = (charge?: { _id: Id<"loanCharges">; amount: number; dueDate: string }) => {
    setPaymentFormOpen(true);
    setPaymentData((prev) => ({
      ...prev,
      chargeId: charge?._id ?? "",
      amount: charge ? String(charge.amount) : loan.monthlyPayment ? String(loan.monthlyPayment) : "",
      dueDate: charge?.dueDate ?? prev.dueDate,
      status: charge ? getDefaultPaymentStatus(charge.dueDate) : prev.status,
    }));
  };

  const handleScheduledChargeSelect = (chargeId: string) => {
    const charge = scheduledCharges.find((item) => item._id === chargeId);
    setPaymentData((prev) => ({
      ...prev,
      chargeId,
      ...(charge
        ? {
            amount: String(charge.amount),
            dueDate: charge.dueDate,
            status: getDefaultPaymentStatus(charge.dueDate),
          }
        : {}),
    }));
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateStatus({
        id,
        status: newStatus as (typeof STATUSES)[number],
      });
      toast.success("Status updated");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update status"));
    }
  };

  const handleRecordLoanReturned = async () => {
    if (!returnData.returnedDate) return;
    setReturnSaving(true);
    try {
      await recordLoanReturned({
        id,
        returnedDate: returnData.returnedDate,
        notes: returnData.notes || undefined,
      });
      setReturnFormOpen(false);
      setReturnData({ returnedDate: formatUsDate(new Date()), notes: "" });
      toast.success("Funds returned recorded. Loan removed from monthly payment reminders.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to record returned funds"));
    } finally {
      setReturnSaving(false);
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
      paymentType: loan.paymentType ?? "monthly",
      drawFundsTotal: loan.drawFundsTotal ? String(loan.drawFundsTotal) : "",
      drawFundsUsed: loan.drawFundsUsed ? String(loan.drawFundsUsed) : "",
      closeDate: loan.closeDate ?? "",
      maturityDate: loan.maturityDate ?? "",
      titleCompany: loan.titleCompany ?? "",
      titleCompanyContact: loan.titleCompanyContact ?? "",
      strategy: loan.strategy ?? "",
      notes: loan.notes ?? "",
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const totalLoanAmount = getLoanAmountFromPurchaseAndRehab(
        editData.purchasePrice,
        editData.rehabBudgetTotal
      );
      const pointsEarned = calculatePoints(totalLoanAmount, DEFAULT_POINTS_PERCENTAGE);

      await updateLoan({
        id,
        borrowerName: editData.borrowerName,
        entityName: editData.entityName,
        propertyAddress: editData.propertyAddress,
        purchasePrice: Number(editData.purchasePrice),
        loanAmount: totalLoanAmount,
        afterRepairValue: editData.afterRepairValue ? Number(editData.afterRepairValue) : undefined,
        rehabBudgetTotal: editData.rehabBudgetTotal ? Number(editData.rehabBudgetTotal) : undefined,
        terms: editData.terms,
        interestRate: Number(editData.interestRate),
        monthlyPayment: Number(editData.monthlyPayment),
        pointsEarned,
        monthlyInterestEarned: editData.monthlyInterestEarned ? Number(editData.monthlyInterestEarned) : undefined,
        paymentType: editData.paymentType as "balloon" | "monthly",
        drawFundsTotal: editData.drawFundsTotal ? Number(editData.drawFundsTotal) : undefined,
        drawFundsUsed: editData.drawFundsUsed ? Number(editData.drawFundsUsed) : undefined,
        closeDate: editData.closeDate || undefined,
        maturityDate: editData.maturityDate || undefined,
        titleCompany: editData.titleCompany || undefined,
        titleCompanyContact: editData.titleCompanyContact || undefined,
        strategy: (editData.strategy || undefined) as "flip_and_resell" | "brrrr" | undefined,
        notes: editData.notes || undefined,
      });
      setEditing(false);
      toast.success("Loan saved");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save loan"));
    } finally {
      setSaving(false);
    }
  };

  const handleCloseDateChange = (closeDate: string) => {
    setEditData((prev) => {
      const previousAutoMaturity = getSixMonthMaturityDate(prev.closeDate ?? "");
      const nextAutoMaturity = getSixMonthMaturityDate(closeDate);
      const shouldUpdateMaturity = !prev.maturityDate || prev.maturityDate === previousAutoMaturity;

      return {
        ...prev,
        closeDate,
        maturityDate: shouldUpdateMaturity ? nextAutoMaturity : prev.maturityDate,
      };
    });
  };

  const handleTitleContactSelect = (value: string) => {
    if (value === "") {
      setEditData((prev) => ({
        ...prev,
        titleCompany: "",
        titleCompanyContact: "",
      }));
      return;
    }

    const contact = titleContacts[Number(value)];
    if (!contact) return;

    setEditData((prev) => ({
      ...prev,
      titleCompany: contact.titleCompany,
      titleCompanyContact: contact.titleCompanyContact ?? "",
    }));
  };

  const updateLoanAmountParts = (updates: Partial<Record<string, string>>) => {
    setEditData((prev) => {
      const next = { ...prev, ...updates };
      const loanAmount = getLoanAmountFromPurchaseAndRehab(
        next.purchasePrice ?? "",
        next.rehabBudgetTotal ?? ""
      );
      const rate = Number(next.interestRate) || 0;
      const principalOut = getCurrentPrincipalOut({
        loanAmount,
        drawFundsTotal: Number(next.drawFundsTotal) || undefined,
        drawFundsUsed: Number(next.drawFundsUsed) || undefined,
      });
      const monthly = next.paymentType === "balloon" ? 0 : calculateMonthlyInterest(principalOut, rate);
      const points = calculatePoints(loanAmount, DEFAULT_POINTS_PERCENTAGE);

      return {
        ...next,
        loanAmount: loanAmount ? String(loanAmount) : "",
        monthlyPayment: monthly ? String(monthly) : "",
        pointsEarned: points ? String(points) : "",
      };
    });
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
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`File is too large (${formatFileSize(file.size)}). Maximum size is ${formatFileSize(MAX_FILE_SIZE_BYTES)}.`);
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
      toast.error(getErrorMessage(err, "Failed to upload closing statement"));
    } finally {
      setClosingUploading(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentData.amount || !paymentData.paymentDate || !paymentData.dueDate) return;
    setPaymentSaving(true);
    try {
      const result = await recordPayment({
        loanId: id,
        chargeId: paymentData.chargeId ? paymentData.chargeId as Id<"loanCharges"> : undefined,
        amount: Number(paymentData.amount),
        paymentDate: paymentData.paymentDate,
        dueDate: paymentData.dueDate,
        method: paymentData.method,
        status: paymentData.status,
        notes: paymentData.notes || undefined,
      });
      setPaymentFormOpen(false);
      setPaymentData({
        chargeId: "",
        amount: loan.monthlyPayment ? String(loan.monthlyPayment) : "",
        paymentDate: "",
        dueDate: "",
        method: "ach",
        status: "on_time",
        notes: "",
      });
      toast.success(
        result.chargeMarkedPaid
          ? "Payment recorded and scheduled charge marked paid."
          : paymentData.chargeId
            ? "Payment recorded. Scheduled charge remains open for follow-up."
            : "Payment recorded"
      );
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to record payment"));
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

  const chargeColumns: Column<Record<string, unknown>>[] = [
    {
      key: "type",
      header: "Type",
      render: (row) => <StatusBadge status={row.type as string} />,
    },
    {
      key: "amount",
      header: "Amount",
      render: (row) => formatCurrency(row.amount as number),
    },
    {
      key: "periodStart",
      header: "Period",
      render: (row) => `${row.periodStart as string} - ${row.periodEnd as string}`,
      className: "hidden md:table-cell",
    },
    { key: "dueDate", header: "Due" },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status as string} />,
    },
    {
      key: "_id",
      header: "",
      render: (row) =>
        row.status === "scheduled" ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openPaymentFormForCharge({
                _id: row._id as Id<"loanCharges">,
                amount: row.amount as number,
                dueDate: row.dueDate as string,
              });
            }}
            className="rounded-lg border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
          >
            Record
          </button>
        ) : null,
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
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-[background-color,scale] duration-150 hover:bg-muted active:scale-[0.96]"
                  >
                    <X className="size-4" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-[background-color,scale] duration-150 hover:bg-primary/80 active:scale-[0.96] disabled:opacity-50 disabled:active:scale-100"
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
                <>
                  {canRecordReturned && (
                    <button
                      type="button"
                      onClick={() => setReturnFormOpen(true)}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-[background-color,scale] duration-150 hover:bg-primary/80 active:scale-[0.96]"
                    >
                      <RotateCcw className="size-4" />
                      Record Funds Returned
                    </button>
                  )}
                  <button
                    onClick={startEditing}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-[background-color,scale] duration-150 hover:bg-muted active:scale-[0.96]"
                  >
                    <Pencil className="size-4" />
                    Edit
                  </button>
                </>
              )}
            </div>
          }
        />
      </div>

      {loan.returnedDate && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_12px_32px_rgba(0,0,0,0.04)] dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-balance">Funds Returned</p>
              <p className="mt-1 text-sm">Returned on <span className="tabular-nums">{loan.returnedDate}</span></p>
              {loan.returnedNotes && (
                <p className="mt-2 text-sm text-emerald-700/80 dark:text-emerald-300/80">
                  {loan.returnedNotes}
                </p>
              )}
            </div>
            <StatusBadge status="closed" />
          </div>
        </div>
      )}

      {/* Status */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">
          Loan Status
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {STATUSES.map((status) => {
            const isCurrent = loan.status === status;
            const canChange = canChangeLoanStatus(loan.status, status);

            return (
              <button
                key={status}
                type="button"
                onClick={() => {
                  if (canChange) handleStatusChange(status);
                }}
                disabled={!canChange}
                title={canChange ? undefined : `Cannot move from ${loan.status} to ${status}`}
                className={`min-h-10 transition-[opacity,scale] duration-150 ${
                  isCurrent
                    ? "opacity-100"
                    : canChange
                      ? "opacity-40 hover:opacity-70 active:scale-[0.96]"
                      : "cursor-not-allowed opacity-25"
                }`}
              >
                <StatusBadge status={status} />
              </button>
            );
          })}
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
                  <label className="text-sm text-muted-foreground">Strategy</label>
                  <select
                    className={field("strategy").className}
                    value={editData.strategy}
                    onChange={(e) => setEditData((p) => ({ ...p, strategy: e.target.value }))}
                  >
                    <option value="">— None —</option>
                    {Object.entries(STRATEGY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Address</label>
                  <AddressInput {...field("propertyAddress")} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">After Repair Value</label>
                  <input {...field("afterRepairValue")} type="number" />
                </div>
              </>
            ) : (
              <>
                <DetailRow
                  label="Strategy"
                  value={loan.strategy ? STRATEGY_LABELS[loan.strategy] : undefined}
                />
                <DetailRow label="Address" value={loan.propertyAddress} />
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
                  <label className="text-sm text-muted-foreground">Purchase Price</label>
                  <input
                    {...field("purchasePrice")}
                    type="number"
                    onChange={(e) => updateLoanAmountParts({ purchasePrice: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Rehab Budget</label>
                  <input
                    {...field("rehabBudgetTotal")}
                    type="number"
                    onChange={(e) => updateLoanAmountParts({ rehabBudgetTotal: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Total Loan Amount</label>
                  <input
                    {...field("loanAmount")}
                    type="number"
                    readOnly
                    className="w-full rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm font-medium focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Terms</label>
                  <input {...field("terms")} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Interest Rate (%)</label>
                  <input
                    {...field("interestRate")}
                    type="number"
                    step="0.01"
                    onChange={(e) =>
                      updateLoanAmountParts({ interestRate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Monthly Payment</label>
                  <input
                    {...field("monthlyPayment")}
                    type="number"
                    readOnly
                    className="w-full rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm font-medium focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Points Earned</label>
                  <input
                    {...field("pointsEarned")}
                    type="number"
                    readOnly
                    className="w-full rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm font-medium focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Monthly Interest Earned</label>
                  <input {...field("monthlyInterestEarned")} type="number" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Payment Type</label>
                  <select
                    value={editData.paymentType ?? "monthly"}
                    onChange={(e) =>
                      updateLoanAmountParts({ paymentType: e.target.value })
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                  >
                    {Object.entries(PAYMENT_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <DetailRow label="Purchase Price" value={formatCurrency(loan.purchasePrice)} />
                <DetailRow
                  label="Rehab Budget"
                  value={loan.rehabBudgetTotal ? formatCurrency(loan.rehabBudgetTotal) : undefined}
                />
                <DetailRow label="Total Loan Amount" value={formatCurrency(loan.loanAmount)} />
                <DetailRow label="Current Principal Out" value={formatCurrency(currentPrincipalOut)} />
                <DetailRow label="Terms" value={loan.terms} />
                <DetailRow label="Interest Rate" value={`${loan.interestRate}%`} />
                <DetailRow label="Current Monthly Payment" value={formatCurrency(currentMonthlyPayment)} />
                <DetailRow label="Points Earned" value={formatCurrency(loan.pointsEarned)} />
                <DetailRow
                  label="Monthly Interest"
                  value={loan.monthlyInterestEarned ? formatCurrency(loan.monthlyInterestEarned) : undefined}
                />
                <DetailRow
                  label="Payment Type"
                  value={PAYMENT_TYPE_LABELS[loan.paymentType ?? "monthly"]}
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
                  <DatePickerField
                    value={editData.closeDate ?? ""}
                    onChange={handleCloseDateChange}
                    placeholder="Select close date"
                    ariaLabel="Close Date"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Maturity Date</label>
                  <DatePickerField
                    value={editData.maturityDate ?? ""}
                    onChange={(value) => setEditData((prev) => ({ ...prev, maturityDate: value }))}
                    placeholder="Select maturity date"
                    ariaLabel="Maturity Date"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Auto-fills six months after close date. You can still edit it.
                  </p>
                </div>
                {titleContacts.length > 0 && (
                  <div className="rounded-xl border border-border bg-muted/25 p-3">
                    <label className="text-sm text-muted-foreground">Saved Title Contacts</label>
                    <select
                      className={field("titleCompany").className}
                      defaultValue=""
                      onChange={(e) => handleTitleContactSelect(e.target.value)}
                    >
                      <option value="">Select a saved title contact…</option>
                      {titleContacts.map((contact, index) => (
                        <option key={`${contact.titleCompany}-${contact.titleCompanyContact ?? ""}-${index}`} value={index}>
                          {contact.titleCompany}{contact.titleCompanyContact ? ` — ${contact.titleCompanyContact}` : ""}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-muted-foreground">
                      New company/contact pairs are saved to this borrower after you save.
                    </p>
                  </div>
                )}
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

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-1 text-sm font-medium text-muted-foreground">
            Construction Holdback
          </h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Approved draws subtract from the holdback amount to calculate draw remaining.
          </p>
          <div className="space-y-3">
            {editing ? (
              <>
                <div>
                  <label className="text-sm text-muted-foreground">Construction Holdback Amount</label>
                  <input
                    {...field("drawFundsTotal")}
                    type="number"
                    onChange={(e) => updateLoanAmountParts({ drawFundsTotal: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Approved Draws Used</label>
                  <input
                    {...field("drawFundsUsed")}
                    type="number"
                    onChange={(e) => updateLoanAmountParts({ drawFundsUsed: e.target.value })}
                  />
                </div>
                <DetailRow
                  label="Draw Amount Remaining"
                  value={editData.drawFundsTotal
                    ? formatCurrency(Math.max(0, Number(editData.drawFundsTotal) - (Number(editData.drawFundsUsed) || 0)))
                    : undefined}
                />
              </>
            ) : (
              <>
                <DetailRow
                  label="Construction Holdback Amount"
                  value={loan.drawFundsTotal ? formatCurrency(loan.drawFundsTotal) : undefined}
                />
                <DetailRow
                  label="Approved Draws Used"
                  value={loan.drawFundsUsed ? formatCurrency(loan.drawFundsUsed) : formatCurrency(0)}
                />
                <DetailRow
                  label="Draw Amount Remaining"
                  value={loan.drawFundsTotal !== undefined
                    ? formatCurrency(Math.max(0, loan.drawFundsTotal - (loan.drawFundsUsed ?? 0)))
                    : undefined}
                />
                <DetailRow
                  label="Current Principal Out"
                  value={formatCurrency(currentPrincipalOut)}
                />
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

      {/* Payoff Estimate */}
      {["funded", "sent_to_title", "closed"].includes(loan.status) && loan.closeDate && (() => {
        const totalPaymentsReceived = payments
          ? payments.filter((p) => p.status !== "missed").reduce((sum, p) => sum + p.amount, 0)
          : 0;
        const payoff = calculatePayoffEstimate(
          loan.loanAmount,
          loan.interestRate,
          loan.closeDate,
          new Date(),
          (loan.paymentType as "balloon" | "monthly") ?? "monthly",
          totalPaymentsReceived
        );
        if (!payoff) return null;
        return (
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="mb-4 text-sm font-medium text-muted-foreground">
              Payoff Estimate
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Principal</p>
                <p className="text-sm font-semibold">{formatCurrency(payoff.principal)}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Accrued / Unpaid Interest</p>
                <p className="text-sm font-semibold">{formatCurrency(payoff.accruedInterest)}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Total Payoff</p>
                <p className="text-lg font-bold text-primary">{formatCurrency(payoff.totalPayoff)}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Months Since Close</p>
                <p className="text-sm font-semibold">{payoff.monthsAccrued}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Property Comps */}
      <PropertyComps loanId={id} />

      {/* Rehab Budget */}
      <RehabBudgetEditor loanId={id} />

      {/* Charges */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">
              Charges / Interest Schedule
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Charges owed are tracked separately from payments received.
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-right">
            <p className="text-xs text-muted-foreground">Current Monthly</p>
            <p className="text-sm font-semibold">{formatCurrency(currentMonthlyPayment)}</p>
          </div>
        </div>
        {charges && charges.length > 0 ? (
          <DataTable
            data={charges as unknown as Record<string, unknown>[]}
            columns={chargeColumns}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            No interest charges scheduled yet. Set a close date to create prepaid and first monthly interest charges.
          </p>
        )}
      </div>

      {/* Payment History */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Payment History
          </h3>
          {["funded", "closed", "sent_to_title"].includes(loan.status) && (
            <button
              onClick={() => {
                if (paymentFormOpen) setPaymentFormOpen(false);
                else openPaymentFormForCharge(nextScheduledCharge);
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
              {scheduledCharges.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Scheduled Charge</label>
                  <select
                    value={paymentData.chargeId}
                    onChange={(e) => handleScheduledChargeSelect(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                  >
                    <option value="">No scheduled charge</option>
                    {scheduledCharges.map((charge) => (
                      <option key={charge._id} value={charge._id}>
                        {charge.dueDate} - {formatCurrency(charge.amount)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
                <DatePickerField
                  value={paymentData.paymentDate}
                  onChange={(value) => setPaymentData((p) => ({ ...p, paymentDate: value }))}
                  placeholder="Select payment date"
                  required
                  ariaLabel="Payment Date"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Due Date</label>
                <DatePickerField
                  value={paymentData.dueDate}
                  onChange={(value) => setPaymentData((p) => ({ ...p, dueDate: value }))}
                  placeholder="Select due date"
                  required
                  ariaLabel="Due Date"
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
                <DocumentPreviewRow key={doc._id} document={doc} />
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
      {returnFormOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="return-funds-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !returnSaving) setReturnFormOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[0_8px_48px_rgba(0,0,0,0.18)] animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-150">
            <h3 id="return-funds-title" className="text-lg font-semibold text-balance">
              Record Funds Returned
            </h3>
            <p className="mt-2 text-sm text-muted-foreground text-pretty">
              This will mark the loan closed and remove it from monthly payment reminders.
            </p>
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Return Date</label>
                <DatePickerField
                  value={returnData.returnedDate}
                  onChange={(value) => setReturnData((prev) => ({ ...prev, returnedDate: value }))}
                  required
                  ariaLabel="Return Date"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Notes</label>
                <textarea
                  value={returnData.notes}
                  onChange={(event) => setReturnData((prev) => ({ ...prev, notes: event.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                  placeholder="Optional notes about the return"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setReturnFormOpen(false)}
                disabled={returnSaving}
                className="min-h-10 rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-[background-color,scale] duration-150 hover:bg-muted active:scale-[0.96] disabled:opacity-50 disabled:active:scale-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRecordLoanReturned}
                disabled={returnSaving || !returnData.returnedDate}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-[background-color,scale] duration-150 hover:bg-primary/90 active:scale-[0.96] disabled:opacity-50 disabled:active:scale-100"
              >
                {returnSaving && <Loader2 className="size-4 animate-spin" />}
                Save Return
              </button>
            </div>
          </div>
        </div>
      )}
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
