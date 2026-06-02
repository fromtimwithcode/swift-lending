"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { LoanStatusTimeline } from "@/components/dashboard/loan-status-timeline";
import { DocumentChecklist } from "@/components/dashboard/document-checklist";
import { DrawDocumentFolders, type DrawFolderDraw } from "@/components/dashboard/draw-document-folders";
import { FileUploadDialog } from "@/components/dashboard/file-upload-dialog";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { calculatePayoffEstimate } from "@/lib/loan-calc";
import { calculateMonthlyInterest, getCurrentPrincipalOut } from "@/convex/lib/loanCalculations";
import { PAYMENT_TYPE_LABELS, isDrawEligibleLoanStatus } from "@/convex/lib/constants";
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
  const isRepeatEntity = useQuery(api.borrower.isRepeatEntity, { loanId: id });
  const loanPayments = useQuery(api.borrower.getMyLoanPayments, { loanId: id });
  const charges = useQuery(api.loanCharges.getMyChargesForLoan, { loanId: id });
  const [uploadDrawId, setUploadDrawId] = useState<Id<"drawRequests"> | undefined>();

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
  const currentPrincipalOut = getCurrentPrincipalOut(loan);
  const currentMonthlyPayment = calculateMonthlyInterest(currentPrincipalOut, loan.interestRate);
  const openDrawUpload = (draw: DrawFolderDraw) => setUploadDrawId(draw._id);
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
            <DetailRow
              label="Current Principal Out"
              value={formatCurrency(currentPrincipalOut)}
            />
            <DetailRow label="Terms" value={loan.terms} />
            <DetailRow
              label="Interest Rate"
              value={loan.interestRate ? `${loan.interestRate}%` : "—"}
            />
            <DetailRow
              label="Payment Type"
              value={PAYMENT_TYPE_LABELS[loan.paymentType ?? "monthly"]}
            />
            <DetailRow
              label="Current Monthly Payment"
              value={formatCurrency(currentMonthlyPayment)}
            />
            <DetailRow
              label="Points / Origination Fee"
              value={
                loan.pointsEarned
                  ? formatCurrency(loan.pointsEarned)
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
            <DetailRow label="Title Company" value={loan.titleCompany ?? loan.titleCompanyName} />
            <DetailRow label="Title Contact" value={loan.titleCompanyContact} />
            <DetailRow label="Title Contact Email" value={loan.titleCompanyContactEmail} />
            <DetailRow label="Title Contact Phone" value={loan.titleCompanyContactPhone} />
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
            const available = loan.drawFundsTotal !== undefined
              ? loan.drawFundsTotal - (loan.drawFundsUsed ?? 0) - pendingTotal
              : undefined;
            return (
              <div className="space-y-3">
                <DetailRow
                  label="Total Draw Funds"
                  value={
                    loan.drawFundsTotal !== undefined
                      ? formatCurrency(loan.drawFundsTotal)
                      : undefined
                  }
                />
                <DetailRow
                  label="Used"
                  value={
                    loan.drawFundsUsed !== undefined
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

      {/* Payoff Estimate */}
      {["funded", "sent_to_title", "closed"].includes(loan.status) && loan.closeDate && (() => {
        const totalPaymentsReceived = loanPayments
          ? loanPayments.filter((p) => p.status !== "missed").reduce((sum, p) => sum + p.amount, 0)
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
            <p className="mt-3 text-xs text-muted-foreground">
              This is an estimate. Contact your loan officer for the exact payoff amount.
            </p>
          </div>
        );
      })()}

      {/* Payment History */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">
              Charges / Interest Schedule
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Interest charges are shown separately from payments received.
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
          <p className="text-sm text-muted-foreground">No interest charges scheduled yet</p>
        )}
      </div>

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
          {isDrawEligibleLoanStatus(loan.status) && (
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
      {draws && documents && (
        <DrawDocumentFolders
          draws={draws}
          documents={documents}
          title="Draw Document Folders"
          onUploadToDraw={openDrawUpload}
        />
      )}

      {isRepeatEntity !== undefined && (
        <DocumentChecklist loanId={id} isRepeatEntity={isRepeatEntity} />
      )}

      <FileUploadDialog
        open={uploadDrawId !== undefined}
        onClose={() => setUploadDrawId(undefined)}
        loanId={id}
        drawRequestId={uploadDrawId}
        drawOptions={draws ?? []}
        defaultDocType="receipt"
        title="Upload to Draw Folder"
        description="Add receipts, lien waivers, photos, or supporting files to this draw."
      />
    </div>
  );
}
