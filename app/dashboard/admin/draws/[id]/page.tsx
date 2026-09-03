"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { AlertTriangle, Loader2, ArrowLeft, Mail, Pencil, Save, Upload, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { DetailPageSkeleton } from "@/components/dashboard/skeleton";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { DocumentPreviewRow } from "@/components/dashboard/document-preview-row";
import { DatePickerField } from "@/components/dashboard/date-picker-field";
import { FileUploadDialog } from "@/components/dashboard/file-upload-dialog";
import { BorrowerEmailDialog } from "@/components/dashboard/borrower-email-dialog";

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | number | undefined | null;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:gap-4">
      <span className="text-sm font-medium text-muted-foreground sm:w-48 sm:shrink-0">
        {label}
      </span>
      <span className="min-w-0 break-words text-sm tabular-nums [overflow-wrap:anywhere]">{value ?? "—"}</span>
    </div>
  );
}

const REVIEW_STATUSES = ["under_review", "approved", "denied"] as const;

export default function AdminDrawDetailPage() {
  const params = useParams();
  const id = params.id as Id<"drawRequests">;
  const draw = useQuery(api.draws.getDrawRequest, { id });
  const reviewDraw = useMutation(api.draws.reviewDrawRequest);
  const updateDraw = useMutation(api.draws.updateDrawRequest);
  const [notes, setNotes] = useState("");
  const [wireDate, setWireDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const isTerminal = draw !== undefined && (draw.status === "approved" || draw.status === "denied");

  if (draw === undefined) {
    return <DetailPageSkeleton />;
  }
  const fundingNeedsReconciliation = draw.fundingLedgerStatus?.isReconciled === false;

  const handleReview = async (status: (typeof REVIEW_STATUSES)[number]) => {
    if (status === "approved" && !wireDate.trim()) {
      toast.error("Wire date is required to approve a draw");
      return;
    }
    setSaving(true);
    try {
      await reviewDraw({
        id,
        status,
        adminNotes: notes || undefined,
        wireDate: status === "approved" ? wireDate || undefined : undefined,
      });
      toast.success(`Draw request ${status === "approved" ? "approved" : status === "denied" ? "denied" : "updated"}`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update draw request"));
    } finally {
      setSaving(false);
    }
  };

  const startEditingDetails = () => {
    setEditAmount(String(draw.amountRequested));
    setEditDescription(draw.workDescription);
    setEditingDetails(true);
  };

  const handleSaveDetails = async (event: React.FormEvent) => {
    event.preventDefault();
    const amountRequested = Number(editAmount);
    if (!Number.isFinite(amountRequested) || amountRequested <= 0) {
      toast.error("Draw amount must be greater than 0");
      return;
    }
    if (!editDescription.trim()) {
      toast.error("Work description cannot be empty");
      return;
    }

    setEditSaving(true);
    try {
      await updateDraw({
        id,
        amountRequested,
        workDescription: editDescription,
      });
      setEditingDetails(false);
      toast.success("Draw request updated");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update draw request"));
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
        <Link
          href="/dashboard/admin/draws"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <PageHeader
          title="Draw Request Detail"
          description={`${draw.borrowerName} — ${draw.propertyAddress}`}
          actions={
            <button
              type="button"
              onClick={() => setEmailOpen(true)}
              aria-haspopup="dialog"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-[background-color,scale] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.96] max-sm:flex-1"
            >
              <Mail className="size-4" aria-hidden="true" />
              Email Investor
            </button>
          }
        />
      </div>

      {fundingNeedsReconciliation && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 p-4 text-amber-950 dark:text-amber-100"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-balance">Funding history needs reconciliation</p>
            <p className="mt-1 text-sm text-pretty">
              Reconcile the loan&apos;s approved funding records before editing or approving this draw.
            </p>
          </div>
        </div>
      )}

      {/* Status */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">
            Status
          </h3>
          <StatusBadge status={draw.status} />
        </div>

        {/* Review actions */}
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Admin Notes
            </label>
            <textarea
              value={notes || draw.adminNotes || ""}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add notes about this draw request..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          {isTerminal && (
            <p className="text-sm text-muted-foreground">
              This draw request has been {draw.status} and cannot be changed.
            </p>
          )}
          {!isTerminal && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Wire Date
              </label>
              <DatePickerField
                value={wireDate}
                onChange={setWireDate}
                placeholder="Select wire date"
                required
                ariaLabel="Wire Date"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Required to create prorated interest when approving a draw.
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {REVIEW_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => handleReview(status)}
                disabled={saving || isTerminal || (status === "approved" && fundingNeedsReconciliation)}
                className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50 max-sm:flex-1 ${
                  status === "approved"
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : status === "denied"
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "border border-border hover:bg-muted"
                }`}
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                {status === "under_review"
                  ? "Mark Under Review"
                  : status === "approved"
                    ? "Approve"
                    : "Deny"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">
              Request Details
            </h3>
            {!isTerminal && !editingDetails && !fundingNeedsReconciliation && (
              <button
                type="button"
                onClick={startEditingDetails}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-[background-color,scale] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.96]"
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                Edit Draw
              </button>
            )}
          </div>
          {editingDetails ? (
            <form onSubmit={handleSaveDetails} className="space-y-4" aria-busy={editSaving}>
              <div className="space-y-3">
                <DetailRow label="Borrower" value={draw.borrowerName} />
                <DetailRow label="Email" value={draw.borrowerEmail} />
                <DetailRow label="Property" value={draw.propertyAddress} />
              </div>
              <div>
                <label htmlFor="draw-amount-requested" className="mb-1.5 block text-sm font-medium">
                  Amount Requested <span className="text-destructive">*</span>
                </label>
                <input
                  id="draw-amount-requested"
                  type="text"
                  inputMode="decimal"
                  value={editAmount}
                  onChange={(event) => setEditAmount(event.target.value)}
                  disabled={editSaving}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  This amount must fit within the remaining construction holdback after other pending draws.
                </p>
              </div>
              <div>
                <label htmlFor="draw-work-description" className="mb-1.5 block text-sm font-medium">
                  Work Description <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="draw-work-description"
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  disabled={editSaving}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
                />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setEditingDetails(false)}
                  disabled={editSaving}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-[background-color,scale] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.96] disabled:opacity-50"
                >
                  <X className="size-4" aria-hidden="true" />
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-[background-color,scale] hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.96] disabled:opacity-50"
                >
                  {editSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" aria-hidden="true" />}
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <DetailRow label="Borrower" value={draw.borrowerName} />
              <DetailRow label="Email" value={draw.borrowerEmail} />
              <DetailRow label="Property" value={draw.propertyAddress} />
              <DetailRow
                label="Amount Requested"
                value={formatCurrency(draw.amountRequested)}
              />
              <DetailRow label="Description" value={draw.workDescription} />
              <DetailRow label="Wire Date" value={draw.wireDate} />
              <DetailRow
                label="Submitted"
                value={new Date(draw._creationTime).toLocaleDateString()}
              />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            Draw Funds Summary
          </h3>
          <div className="space-y-3">
            <DetailRow
              label="Loan Amount"
              value={formatCurrency(draw.loanAmount)}
            />
            <DetailRow
              label="Total Draw Funds"
              value={
                draw.drawFundsTotal
                  ? formatCurrency(draw.drawFundsTotal)
                  : "—"
              }
            />
            <DetailRow
              label="Used"
              value={draw.fundingLedgerStatus?.isReconciled
                ? formatCurrency(draw.fundingLedgerStatus.recordedTotal)
                : "Unavailable"}
            />
            {draw.drawFundsTotal && (
              <DetailRow
                label="Remaining"
                value={draw.fundingLedgerStatus?.isReconciled
                  ? formatCurrency(
                      draw.drawFundsTotal - draw.fundingLedgerStatus.recordedTotal
                    )
                  : "Unavailable"}
              />
            )}
          </div>
        </div>
      </div>

      {/* Documents */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">
            Attached Documents
          </h3>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <Upload className="size-3" />
            Upload
          </button>
        </div>
        {draw.documents && draw.documents.length > 0 ? (
          <div className="divide-y divide-border">
            {draw.documents.map((doc) => (
              <DocumentPreviewRow
                key={doc._id}
                document={doc}
                previewDocuments={draw.documents}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No documents attached to this draw request
          </p>
        )}
      </div>

      <FileUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        loanId={draw.loanId}
        drawRequestId={id}
        drawOptions={[draw]}
        defaultDocType="receipt"
        title="Upload to Draw Folder"
        description="Add receipts, lien waivers, photos, or supporting files to this draw."
      />
      <BorrowerEmailDialog
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        borrowerId={draw.borrowerId}
        borrowerName={draw.borrowerName}
        loanId={draw.loanId}
        drawRequestId={id}
        contextLabel={`${formatCurrency(draw.amountRequested)} draw request`}
        contextDescription={`${draw.propertyAddress} - ${draw.workDescription}`}
      />
    </div>
  );
}
