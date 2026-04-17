"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { LoanStatusTimeline } from "@/components/dashboard/loan-status-timeline";
import { FileUploadDialog } from "@/components/dashboard/file-upload-dialog";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { ArrowLeft, Upload, Download } from "lucide-react";
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

export default function BorrowerLoanDetailPage() {
  const params = useParams();
  const id = params.id as Id<"loans">;
  const loan = useQuery(api.borrower.getMyLoan, { id });
  const draws = useQuery(api.borrower.getDrawRequestsForLoan, { loanId: id });
  const documents = useQuery(api.documents.getDocumentsForLoan, { loanId: id });
  const loanPayments = useQuery(api.borrower.getMyLoanPayments, { loanId: id });
  const [uploadOpen, setUploadOpen] = useState(false);

  if (loan === undefined) {
    return <DetailPageSkeleton />;
  }

  const drawColumns: Column<Record<string, unknown>>[] = [
    {
      key: "amountRequested",
      header: "Amount",
      render: (row) => formatCurrency(row.amountRequested as number),
    },
    { key: "workDescription", header: "Description" },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status as string} />,
    },
    {
      key: "_creationTime",
      header: "Date",
      render: (row) =>
        new Date(row._creationTime as number).toLocaleDateString(),
    },
    {
      key: "adminNotes",
      header: "Notes",
      render: (row) => (row.adminNotes as string) || "—",
      className: "hidden md:table-cell",
    },
  ];

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
          title={loan.propertyAddress}
          description={`${loan.entityName}`}
        />
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-border bg-card p-6">
        <LoanStatusTimeline status={loan.status} />
      </div>

      {/* Loan Details */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            Property Details
          </h3>
          <div className="space-y-3">
            <DetailRow label="Address" value={loan.propertyAddress} />
            <DetailRow
              label="Purchase Price"
              value={formatCurrency(loan.purchasePrice)}
            />
            <DetailRow
              label="After Repair Value"
              value={
                loan.afterRepairValue
                  ? formatCurrency(loan.afterRepairValue)
                  : undefined
              }
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            Loan Terms
          </h3>
          <div className="space-y-3">
            <DetailRow
              label="Loan Amount"
              value={formatCurrency(loan.loanAmount)}
            />
            <DetailRow label="Terms" value={loan.terms} />
            <DetailRow
              label="Interest Rate"
              value={loan.interestRate ? `${loan.interestRate}%` : "—"}
            />
            <DetailRow
              label="Monthly Payment"
              value={
                loan.monthlyPayment
                  ? formatCurrency(loan.monthlyPayment)
                  : "—"
              }
            />
            <DetailRow
              label="Rehab Budget"
              value={
                loan.rehabBudgetTotal
                  ? formatCurrency(loan.rehabBudgetTotal)
                  : undefined
              }
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            Dates & Title
          </h3>
          <div className="space-y-3">
            <DetailRow label="Close Date" value={loan.closeDate} />
            <DetailRow label="Maturity Date" value={loan.maturityDate} />
            <DetailRow label="Title Company" value={loan.titleCompany} />
            <DetailRow label="Title Contact" value={loan.titleCompanyContact} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            Draw Funds
          </h3>
          {(() => {
            const pendingTotal = (draws ?? [])
              .filter((d) => (d.status as string) === "pending" || (d.status as string) === "under_review")
              .reduce((sum, d) => sum + (d.amountRequested as number), 0);
            const available = loan.drawFundsTotal
              ? loan.drawFundsTotal - (loan.drawFundsUsed ?? 0) - pendingTotal
              : undefined;
            return (
              <div className="space-y-3">
                <DetailRow
                  label="Total Draw Funds"
                  value={
                    loan.drawFundsTotal
                      ? formatCurrency(loan.drawFundsTotal)
                      : undefined
                  }
                />
                <DetailRow
                  label="Used"
                  value={
                    loan.drawFundsUsed
                      ? formatCurrency(loan.drawFundsUsed)
                      : "$0"
                  }
                />
                {pendingTotal > 0 && (
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                    <span className="text-sm font-medium text-muted-foreground sm:w-48 sm:shrink-0">
                      Pending
                    </span>
                    <span className="text-sm text-amber-600 font-medium">
                      {formatCurrency(pendingTotal)}
                    </span>
                  </div>
                )}
                <DetailRow
                  label="Available"
                  value={
                    available !== undefined
                      ? formatCurrency(available)
                      : undefined
                  }
                />
              </div>
            );
          })()}
        </div>
      </div>

      {/* Notes */}
      {loan.notes && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">
            Notes
          </h3>
          <p className="text-sm whitespace-pre-wrap">{loan.notes}</p>
        </div>
      )}

      {/* Payment History */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">
          Payment History
        </h3>
        {loanPayments && loanPayments.length > 0 ? (
          <DataTable
            data={loanPayments as unknown as Record<string, unknown>[]}
            columns={[
              { key: "paymentDate", header: "Date" },
              { key: "dueDate", header: "Due Date" },
              {
                key: "amount",
                header: "Amount",
                render: (row: Record<string, unknown>) =>
                  formatCurrency(row.amount as number),
              },
              {
                key: "method",
                header: "Method",
                render: (row: Record<string, unknown>) => (
                  <StatusBadge status={row.method as string} />
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (row: Record<string, unknown>) => (
                  <StatusBadge status={row.status as string} />
                ),
              },
              {
                key: "notes",
                header: "Notes",
                render: (row: Record<string, unknown>) =>
                  (row.notes as string) || "\u2014",
                className: "hidden md:table-cell",
              },
            ] as Column<Record<string, unknown>>[]}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No payments recorded yet</p>
        )}
      </div>

      {/* Draw Requests */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Draw Requests
          </h3>
          {loan.status === "funded" && (
            <Link
              href={`/dashboard/borrower/draws/new?loanId=${id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80"
            >
              New Draw
            </Link>
          )}
        </div>
        {draws && draws.length > 0 ? (
          <DataTable
            data={draws as unknown as Record<string, unknown>[]}
            columns={drawColumns}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No draw requests yet</p>
        )}
      </div>

      {/* Documents */}
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
                  <p className="text-xs text-muted-foreground">
                    <StatusBadge status={doc.type} />
                  </p>
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

      <FileUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        loanId={id}
      />
    </div>
  );
}
