"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SearchInput } from "@/components/dashboard/search-input";
import { StatusTabFilter } from "@/components/dashboard/status-tab-filter";
import { ExportButton } from "@/components/dashboard/export-button";
import { BulkActionBar } from "@/components/dashboard/bulk-action-bar";
import { Landmark, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { exportToCsv } from "@/lib/export";
import { formatCurrency } from "@/lib/format";
import { PageSkeleton } from "@/components/dashboard/skeleton";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { getErrorMessage } from "@/lib/errors";

type TabFilter = "all" | "pipeline" | "closed" | "returned";

const PIPELINE_STATUSES = [
  "submitted",
  "under_review",
  "additional_info_needed",
  "approved",
  "funded",
  "sent_to_title",
];

const LOAN_STATUSES = [
  "submitted",
  "under_review",
  "additional_info_needed",
  "approved",
  "denied",
  "funded",
  "sent_to_title",
  "closed",
] as const;

export default function AdminLoansPage() {
  const loans = useQuery(api.admin.getLoans, {});
  const bulkUpdateStatus = useMutation(api.admin.bulkUpdateLoanStatus);
  const bulkDeleteLoans = useMutation(api.admin.bulkDeleteLoans);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
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

    if (activeTab === "pipeline") {
      filtered = filtered.filter((l) => PIPELINE_STATUSES.includes(l.status) && !l.returnedDate);
    } else if (activeTab === "closed") {
      filtered = filtered.filter((l) => l.status === "closed" && !l.returnedDate);
    } else if (activeTab === "returned") {
      filtered = filtered.filter((l) => Boolean(l.returnedDate));
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
    setBulkStatusOpen(false);
  }, [search, activeTab]);

  if (loans === undefined) {
    return <PageSkeleton />;
  }

  const tabs = [
    { label: "All", value: "all", count: loans.length },
    {
      label: "Pipeline",
      value: "pipeline",
      count: loans.filter((l) => PIPELINE_STATUSES.includes(l.status) && !l.returnedDate).length,
    },
    {
      label: "Closed",
      value: "closed",
      count: loans.filter((l) => l.status === "closed" && !l.returnedDate).length,
    },
    {
      label: "Loans Returned",
      value: "returned",
      count: loans.filter((l) => Boolean(l.returnedDate)).length,
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
      header: "Status",
      sortable: true,
      render: (row) => <StatusBadge status={row.status} />,
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
      className: activeTab === "returned" ? "" : "hidden xl:table-cell",
    },
  ];

  const exportColumns = [
    { header: "Borrower", key: "borrowerName" },
    { header: "Entity", key: "entityName" },
    { header: "Property", key: "propertyAddress" },
    { header: "Loan Amount", key: "loanAmount" },
    { header: "Interest Rate", key: "interestRate" },
    { header: "Monthly Payment", key: "monthlyPayment" },
    { header: "Status", key: "status" },
    { header: "Close Date", key: "closeDate" },
    { header: "Returned Date", key: "returnedDate" },
    { header: "Terms", key: "terms" },
    { header: "Points Earned", key: "pointsEarned" },
  ];

  const exportData =
    selectedIds.size > 0
      ? filteredLoans.filter((l) => selectedIds.has(l._id))
      : filteredLoans;

  const handleBulkStatusChange = (status: string) => {
    setConfirmAction({
      title: `Change status of ${selectedIds.size} loan(s) to "${status}"?`,
      confirmLabel: "Confirm",
      action: async () => {
        const loanIds = [...selectedIds] as Id<"loans">[];
        setBulkLoading(true);
        try {
          const results = await bulkUpdateStatus({
            loanIds,
            status: status as (typeof LOAN_STATUSES)[number],
          });
          const failures = results.filter((r: { success: boolean; error?: string }) => !r.success);
          if (failures.length > 0) {
            toast.warning(`${results.length - failures.length} succeeded, ${failures.length} failed`);
          } else {
            toast.success(`${results.length} loan(s) updated`);
          }
          setSelectedIds(new Set());
          setBulkStatusOpen(false);
        } catch {
          toast.error("Bulk status update failed. Please try again.");
        } finally {
          setBulkLoading(false);
          setConfirmAction(null);
        }
      },
    });
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
          setBulkStatusOpen(false);
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
    <div className="space-y-6">
      <PageHeader
        title="Loans"
        description={`${loans.length} total loans`}
        actions={
          <div className="flex items-center gap-2">
            <ExportButton
              data={exportData as unknown as Record<string, unknown>[]}
              columns={exportColumns}
              filename="loans"
              title="Loans Report"
            />
            <Link
              href="/dashboard/admin/loans/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
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

      <BulkActionBar
        selectedCount={selectedIds.size}
        onClear={() => { setSelectedIds(new Set()); setBulkStatusOpen(false); }}
        disabled={bulkLoading}
        actions={[
          {
            label: bulkStatusOpen ? "Cancel" : "Change Status",
            onClick: () => setBulkStatusOpen(!bulkStatusOpen),
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
                  selected as unknown as Record<string, unknown>[]
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

      {bulkStatusOpen && selectedIds.size > 0 && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card p-3 shadow-lg">
            {LOAN_STATUSES.map((status) => (
              <button
                key={status}
                onClick={() => handleBulkStatusChange(status)}
                disabled={bulkLoading}
                className="min-h-10 transition-[opacity,scale] duration-150 hover:opacity-80 active:scale-[0.96] disabled:opacity-50 disabled:active:scale-100"
              >
                <StatusBadge status={status} />
              </button>
            ))}
          </div>
        </div>
      )}
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
