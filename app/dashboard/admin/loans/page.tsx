"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/dashboard/page-header";
import { LoanStatusDialog } from "@/components/dashboard/loan-status-dialog";
import { type LoanStatus } from "@/convex/lib/loanStatus";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SearchInput } from "@/components/dashboard/search-input";
import { StatusTabFilter } from "@/components/dashboard/status-tab-filter";
import { ExportButton } from "@/components/dashboard/export-button";
import { BulkActionBar } from "@/components/dashboard/bulk-action-bar";
import { Landmark, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { exportToCsv } from "@/lib/export";
import { formatCurrency } from "@/lib/format";
import { PageSkeleton } from "@/components/dashboard/skeleton";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { getErrorMessage } from "@/lib/errors";
import {
  getLoanDisplayStatus,
  getLoanDisplayStatusLabel,
  getLoanStatusLabel,
  isActiveLoanDisplay,
  isClosedLoanDisplay,
  isFundsReturnedLoan,
} from "@/lib/loan-display";

type TabFilter = "all" | "active" | "closed" | "funds_returned";

export default function AdminLoansPage() {
  const loans = useQuery(api.admin.getLoans, {});
  const bulkUpdateStatus = useMutation(api.admin.bulkUpdateLoanStatus);
  const bulkDeleteLoans = useMutation(api.admin.bulkDeleteLoans);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const pageRef = useRef<HTMLDivElement>(null);
  const [statusChange, setStatusChange] = useState<{
    trigger: HTMLElement | null;
    loans: { loanId: Id<"loans">; status: LoanStatus; propertyAddress: string }[];
  } | null>(null);
  const [bulkFailures, setBulkFailures] = useState<{ loanId: string; propertyAddress: string; error: string }[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description?: string;
    confirmLabel?: string;
    variant?: "default" | "destructive";
    action: () => Promise<void>;
  } | null>(null);

  const filteredLoans = useMemo(() => {
    if (!loans) return [];

    let filtered = [...loans];

    if (activeTab === "active") {
      filtered = filtered.filter(isActiveLoanDisplay);
    } else if (activeTab === "closed") {
      filtered = filtered.filter(isClosedLoanDisplay);
    } else if (activeTab === "funds_returned") {
      filtered = filtered.filter(isFundsReturnedLoan);
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.borrowerName.toLowerCase().includes(q) ||
          l.propertyAddress.toLowerCase().includes(q) ||
          l.entityName.toLowerCase().includes(q)
      );
    }

    return filtered.sort((a, b) => b._creationTime - a._creationTime);
  }, [loans, activeTab, search]);

  const handleSearch = useCallback((v: string) => setSearch(v), []);

  // Clear selections when filters change so bulk ops don't act on hidden rows
  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, activeTab]);

  if (loans === undefined) {
    return <PageSkeleton />;
  }

  const tabs = [
    { label: "All", value: "all", count: loans.length },
    {
      label: "Active",
      value: "active",
      count: loans.filter(isActiveLoanDisplay).length,
    },
    {
      label: "Closed",
      value: "closed",
      count: loans.filter(isClosedLoanDisplay).length,
    },
    {
      label: "Funds Returned",
      value: "funds_returned",
      count: loans.filter(isFundsReturnedLoan).length,
    },
  ];

  const columns: Column<(typeof filteredLoans)[number]>[] = [
    { key: "borrowerName", header: "Borrower", sortable: true },
    {
      key: "entityName",
      header: "Entity",
      sortable: true,
      className: "hidden md:table-cell",
    },
    {
      key: "propertyAddress",
      header: "Property",
      sortable: true,
      className: "max-w-[200px] truncate",
    },
    {
      key: "loanAmount",
      header: "Loan Amount",
      sortable: true,
      render: (row) => <span className="tabular-nums">{formatCurrency(row.loanAmount)}</span>,
    },
    {
      key: "interestRate",
      header: "Rate",
      sortable: true,
      render: (row) => <span className="tabular-nums">{row.interestRate}%</span>,
      className: "hidden lg:table-cell",
    },
    {
      key: "monthlyPayment",
      header: "Monthly",
      sortable: true,
      render: (row) => <span className="tabular-nums">{formatCurrency(row.monthlyPayment)}</span>,
      className: "hidden lg:table-cell",
    },
    {
      key: "status",
      header: "Loan State",
      sortable: true,
      render: (row) => (
        <div className="space-y-1">
          <StatusBadge status={getLoanDisplayStatus(row)} />
          {isActiveLoanDisplay(row) && (
            <p className="text-xs text-muted-foreground">{getLoanStatusLabel(row.status)}</p>
          )}
          {isFundsReturnedLoan(row) && row.returnedDate && (
            <p className="text-xs text-muted-foreground tabular-nums">Returned {row.returnedDate}</p>
          )}
        </div>
      ),
    },
    {
      key: "closeDate",
      header: "Close Date",
      sortable: true,
      render: (row) => row.closeDate ? <span className="tabular-nums">{row.closeDate}</span> : "—",
      className: "hidden md:table-cell",
    },
    {
      key: "returnedDate",
      header: "Returned",
      sortable: true,
      render: (row) => row.returnedDate ? <span className="tabular-nums">{row.returnedDate}</span> : "—",
      className: activeTab === "funds_returned" ? "" : "hidden xl:table-cell",
    },
  ];

  const exportColumns = [
    { header: "Borrower", key: "borrowerName" },
    { header: "Entity", key: "entityName" },
    { header: "Property", key: "propertyAddress" },
    { header: "Loan Amount", key: "loanAmount" },
    { header: "Interest Rate", key: "interestRate" },
    { header: "Monthly Payment", key: "monthlyPayment" },
    { header: "Loan State", key: "loanState" },
    { header: "Workflow Status", key: "workflowStatus" },
    { header: "Close Date", key: "closeDate" },
    { header: "Returned Date", key: "returnedDate" },
    { header: "Returned Amount", key: "returnedAmount" },
    { header: "Terms", key: "terms" },
    { header: "Points Earned", key: "pointsEarned" },
  ];

  const addLoanExportFields = (loan: (typeof filteredLoans)[number]) => ({
    ...loan,
    loanState: getLoanDisplayStatusLabel(loan),
    workflowStatus: getLoanStatusLabel(loan.status),
  });

  const exportData =
    selectedIds.size > 0
      ? filteredLoans.filter((l) => selectedIds.has(l._id)).map(addLoanExportFields)
      : filteredLoans.map(addLoanExportFields);

  const handleBulkStatusChange = () => {
    setStatusChange({ trigger: document.activeElement instanceof HTMLElement ? document.activeElement : null, loans: loans.filter((loan) => selectedIds.has(loan._id)).map((loan) => ({
      loanId: loan._id, status: loan.status, propertyAddress: loan.propertyAddress,
    })) });
  };

  const handleBulkStatusSave = async (note: string, status: LoanStatus) => {
    if (!statusChange) return;
    setBulkLoading(true);
    try {
      const results = await bulkUpdateStatus({
        loanIds: statusChange.loans.map((loan) => loan.loanId),
        expectedStatuses: statusChange.loans.map(({ loanId, status }) => ({ loanId, status })),
        status,
        note,
      });
      const failures = results.filter((result) => !result.success).map((result) => ({
        loanId: result.loanId,
        propertyAddress: statusChange.loans.find((loan) => loan.loanId === result.loanId)?.propertyAddress ?? "Loan unavailable",
        error: result.error ?? "Could not update this loan.",
      }));
      setBulkFailures(failures);
      setSelectedIds(new Set(failures.map((result) => result.loanId)));
      const updated = results.filter((result) => result.changed).length;
      const unchanged = results.filter((result) => result.success && !result.changed).length;
      const summary = `${updated} updated${unchanged ? `, ${unchanged} already in this status` : ""}`;
      if (failures.length) toast.warning(`${summary}, ${failures.length} need attention`);
      else toast.success(summary);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = () => {
    const count = selectedIds.size;
    setConfirmAction({
      title: `Permanently delete ${count} loan(s)?`,
      description:
        "This also deletes related draws, documents, payments, charges, messages, and notifications. This action cannot be undone.",
      confirmLabel: "Delete Loans",
      variant: "destructive",
      action: async () => {
        const loanIds = [...selectedIds] as Id<"loans">[];
        setBulkLoading(true);
        try {
          const result = await bulkDeleteLoans({ loanIds });
          toast.success(`${result.deleted} loan(s) deleted`);
          setSelectedIds(new Set());
        } catch (err) {
          toast.error(getErrorMessage(err, "Failed to delete loans"));
        } finally {
          setBulkLoading(false);
          setConfirmAction(null);
        }
      },
    });
  };

  return (
    <div ref={pageRef} tabIndex={-1} className="space-y-6 outline-none">
      <PageHeader
        title="Loans"
        description={`${loans.length} total loans`}
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <ExportButton
              data={exportData as unknown as Record<string, unknown>[]}
              columns={exportColumns}
              filename="loans"
              title="Loans Report"
            />
            <Link
              href="/dashboard/admin/loans/new"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 max-sm:flex-1"
            >
              <Plus className="size-4" />
              Add Loan
            </Link>
          </div>
        }
      />

      <StatusTabFilter
        tabs={tabs}
        activeTab={activeTab}
        onChange={(v) => setActiveTab(v as TabFilter)}
      />

      <SearchInput
        value={search}
        onChange={handleSearch}
        placeholder="Search by borrower, address, or entity..."
      />

      {filteredLoans.length > 0 ? (
        <DataTable
          data={filteredLoans as unknown as Record<string, unknown>[]}
          columns={columns as Column<Record<string, unknown>>[]}
          onRowClick={(row) =>
            router.push(
              `/dashboard/admin/loans/${(row as unknown as { _id: string })._id}`
            )
          }
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      ) : (
        <EmptyState
          icon={Landmark}
          title={search || activeTab !== "all" ? "No loans match your filters" : "No loans yet"}
          description={
            search || activeTab !== "all"
              ? "Try adjusting your search or filter."
              : "Create your first loan to get started."
          }
          action={
            !search && activeTab === "all" ? (
              <Link
                href="/dashboard/admin/loans/new"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
              >
                <Plus className="size-4" />
                Add Loan
              </Link>
            ) : undefined
          }
        />
      )}

      {bulkFailures.length > 0 && (
        <div role="alert" className="space-y-3 rounded-2xl border border-amber-500/25 bg-amber-50/50 p-5 dark:bg-amber-950/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{bulkFailures.length} {bulkFailures.length === 1 ? "loan" : "loans"} could not be updated</h2>
            <button type="button" onClick={() => setBulkFailures([])} className="min-h-11 rounded-lg px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Dismiss</button>
          </div>
          <ul className="space-y-3 text-sm">
            {bulkFailures.map((failure) => <li key={failure.loanId} className="break-words [overflow-wrap:anywhere]">
              <Link className="font-medium underline underline-offset-4" href={`/dashboard/admin/loans/${failure.loanId}`}>{failure.propertyAddress}</Link>
              <p className="mt-1 leading-6 text-muted-foreground">{failure.error}</p>
            </li>)}
          </ul>
        </div>
      )}
      {statusChange && <LoanStatusDialog
        change={{ count: statusChange.loans.length }}
        finalFocus={() => statusChange.trigger?.isConnected ? statusChange.trigger : pageRef.current}
        onSave={handleBulkStatusSave}
        onClose={() => setStatusChange(null)}
      />}

      <BulkActionBar
        selectedCount={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        disabled={bulkLoading}
        actions={[
          {
            label: "Change Status",
            onClick: handleBulkStatusChange,
          },
          {
            label: "Export Selected",
            onClick: () => {
              try {
                const selected = filteredLoans.filter((l) =>
                  selectedIds.has(l._id)
                );
                exportToCsv(
                  "selected-loans",
                  exportColumns,
                  selected.map(addLoanExportFields) as unknown as Record<string, unknown>[]
                );
              } catch {
                toast.error("Export failed. Please try again.");
              }
            },
          },
          {
            label: "Delete Selected",
            icon: <Trash2 className="size-4" />,
            onClick: handleBulkDelete,
            variant: "destructive",
          },
        ]}
      />

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction?.title ?? ""}
        description={confirmAction?.description}
        confirmLabel={confirmAction?.confirmLabel ?? "Confirm"}
        variant={confirmAction?.variant ?? "default"}
        loading={bulkLoading}
        onConfirm={() => confirmAction?.action()}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
