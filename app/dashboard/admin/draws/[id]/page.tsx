"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Loader2, ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { DetailPageSkeleton } from "@/components/dashboard/skeleton";

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

const REVIEW_STATUSES = ["under_review", "approved", "denied"] as const;

export default function AdminDrawDetailPage() {
  const params = useParams();
  const id = params.id as Id<"drawRequests">;
  const draw = useQuery(api.draws.getDrawRequest, { id });
  const reviewDraw = useMutation(api.draws.reviewDrawRequest);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const isTerminal = draw !== undefined && (draw.status === "approved" || draw.status === "denied");

  if (draw === undefined) {
    return <DetailPageSkeleton />;
  }

  const handleReview = async (status: (typeof REVIEW_STATUSES)[number]) => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await reviewDraw({
        id,
        status,
        adminNotes: notes || undefined,
      });
      setSuccess(`Draw request ${status === "approved" ? "approved" : status === "denied" ? "denied" : "updated"} successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update draw request");
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
          title="Draw Request Detail"
          description={`${draw.borrowerName} — ${draw.propertyAddress}`}
        />
      </div>

      {/* Status */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
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
          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
          {isTerminal && (
            <p className="text-sm text-muted-foreground">
              This draw request has been {draw.status} and cannot be changed.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {REVIEW_STATUSES.map((status) => (
              <button
                key={status}
                onClick={() => handleReview(status)}
                disabled={saving || isTerminal}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${
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
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            Request Details
          </h3>
          <div className="space-y-3">
            <DetailRow label="Borrower" value={draw.borrowerName} />
            <DetailRow label="Email" value={draw.borrowerEmail} />
            <DetailRow label="Property" value={draw.propertyAddress} />
            <DetailRow
              label="Amount Requested"
              value={formatCurrency(draw.amountRequested)}
            />
            <DetailRow label="Description" value={draw.workDescription} />
            <DetailRow
              label="Submitted"
              value={new Date(draw._creationTime).toLocaleDateString()}
            />
          </div>
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
              value={formatCurrency(draw.drawFundsUsed ?? 0)}
            />
            {draw.drawFundsTotal && (
              <DetailRow
                label="Remaining"
                value={formatCurrency(
                  draw.drawFundsTotal - (draw.drawFundsUsed ?? 0)
                )}
              />
            )}
          </div>
        </div>
      </div>

      {/* Documents */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">
          Attached Documents
        </h3>
        {draw.documents && draw.documents.length > 0 ? (
          <div className="divide-y divide-border">
            {draw.documents.map((doc) => (
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
          <p className="text-sm text-muted-foreground">
            No documents attached to this draw request
          </p>
        )}
      </div>
    </div>
  );
}
