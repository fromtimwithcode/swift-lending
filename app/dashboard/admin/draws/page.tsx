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
import { HandCoins, Check, XCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import { PageSkeleton } from "@/components/dashboard/skeleton";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { DatePickerField } from "@/components/dashboard/date-picker-field";
import { getErrorMessage } from "@/lib/errors";

type TabFilter = "all" | "pending" | "under_review" | "approved" | "denied";

export default function AdminDrawsPage() {
  const draws = useQuery(api.draws.getAllDrawRequests, {});
  const bulkReview = useMutation(api.draws.bulkReviewDrawRequests);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ title: string; status: "approved" | "denied" } | null>(null);
  const [bulkWireDate, setBulkWireDate] = useState("");

  const filtered = useMemo(() => {
    if (!draws) return [];

    let result = activeTab === "all" ? [...draws] : draws.filter((d) => d.status === activeTab);

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.borrowerName.toLowerCase().includes(q) ||
          d.propertyAddress.toLowerCase().includes(q) ||
          d.workDescription.toLowerCase().includes(q)
      );
    }

    return result;
  }, [draws, activeTab, search]);

  const handleSearch = useCallback((v: string) => setSearch(v), []);

  // Clear selections when filters change so bulk ops don't act on hidden rows
  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, activeTab]);

  if (draws === undefined) {
    return <PageSkeleton />;
  }

  const tabs = [
    { label: "All", value: "all", count: draws.length },
    { label: "Pending", value: "pending", count: draws.filter((d) => d.status === "pending").length },
    { label: "Under Review", value: "under_review", count: draws.filter((d) => d.status === "under_review").length },
    { label: "Approved", value: "approved", count: draws.filter((d) => d.status === "approved").length },
    { label: "Denied", value: "denied", count: draws.filter((d) => d.status === "denied").length },
  ];

  const columns: Column<(typeof draws)[number]>[] = [
    { key: "borrowerName", header: "Borrower", sortable: true },
    {
      key: "propertyAddress",
      header: "Property",
      sortable: true,
      className: "max-w-[180px] truncate",
    },
    {
      key: "amountRequested",
      header: "Amount",
      sortable: true,
      render: (row) => formatCurrency(row.amountRequested),
    },
    { key: "workDescription", header: "Description", className: "hidden lg:table-cell" },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "_creationTime",
      header: "Date",
      sortable: true,
      render: (row) => new Date(row._creationTime).toLocaleDateString(),
      className: "hidden md:table-cell",
    },
  ];

  const exportColumns = [
    { header: "Borrower", key: "borrowerName" },
    { header: "Property", key: "propertyAddress" },
    { header: "Amount", key: "amountRequested" },
    { header: "Description", key: "workDescription" },
    { header: "Status", key: "status" },
  ];

  const handleBulkAction = (status: "approved" | "denied") => {
    const label = status === "approved" ? "Approve" : "Deny";
    setConfirmAction({
      title: `${label} ${selectedIds.size} draw request(s)?`,
      status,
    });
    setBulkWireDate("");
  };

  const handleConfirmBulkAction = async () => {
    if (!confirmAction) return;
    if (bulkLoading) return;
    if (confirmAction.status === "approved" && !bulkWireDate.trim()) {
      toast.error("Wire date is required to approve draws");
      return;
    }

    const drawIds = [...selectedIds] as Id<"drawRequests">[];
    setBulkLoading(true);
    try {
      const results = await bulkReview({
        drawIds,
        status: confirmAction.status,
        wireDate: confirmAction.status === "approved" ? bulkWireDate : undefined,
      });
      const failures = results.filter((r: { success: boolean; error?: string }) => !r.success);
      if (failures.length > 0) {
        toast.warning(`${results.length - failures.length} succeeded, ${failures.length} failed`);
      } else {
        toast.success(`${results.length} draw request(s) ${confirmAction.status}`);
      }
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(getErrorMessage(err, `Bulk ${confirmAction.status} failed. Please try again.`));
    } finally {
      setBulkLoading(false);
      setConfirmAction(null);
      setBulkWireDate("");
    }
  };

  const handleBulkApprove = () => handleBulkAction("approved");
  const handleBulkDeny = () => handleBulkAction("denied");
  const handleCancelBulkAction = () => {
    setConfirmAction(null);
    setBulkWireDate("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Draw Requests"
        description={`${draws.length} total draw request${draws.length !== 1 ? "s" : ""}`}
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <ExportButton
              data={filtered as unknown as Record<string, unknown>[]}
              columns={exportColumns}
              filename="draw-requests"
              title="Draw Requests Report"
            />
            <Link
              href="/dashboard/admin/draws/new"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 max-sm:flex-1"
            >
              <Plus className="size-4" />
              Add Draw Request
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
        placeholder="Search by borrower, property, or description..."
      />

      {filtered.length > 0 ? (
        <DataTable
          data={filtered as unknown as Record<string, unknown>[]}
          columns={columns as Column<Record<string, unknown>>[]}
          onRowClick={(row) =>
            router.push(
              `/dashboard/admin/draws/${(row as unknown as { _id: string })._id}`
            )
          }
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      ) : (
        <EmptyState
          icon={HandCoins}
          title={search || activeTab !== "all" ? "No matching draw requests" : "No draw requests"}
          description={search || activeTab !== "all" ? "Try adjusting your search or filter." : "Borrower-submitted and manually created draw requests will appear here."}
          action={
            !search && activeTab === "all" ? (
              <Link
                href="/dashboard/admin/draws/new"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
              >
                <Plus className="size-4" />
                Add Draw Request
              </Link>
            ) : undefined
          }
        />
      )}

      <BulkActionBar
        selectedCount={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        disabled={bulkLoading}
        actions={[
          {
            label: "Approve Selected",
            icon: <Check className="size-3.5" />,
            onClick: handleBulkApprove,
          },
          {
            label: "Deny Selected",
            icon: <XCircle className="size-3.5" />,
            onClick: handleBulkDeny,
            variant: "destructive",
          },
        ]}
      />
      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction?.title ?? ""}
        description={confirmAction?.status === "approved" ? "Approved draws will use this wire date for prorated interest." : undefined}
        confirmLabel={confirmAction?.status === "approved" ? "Approve" : "Confirm"}
        loading={bulkLoading}
        onConfirm={handleConfirmBulkAction}
        onCancel={handleCancelBulkAction}
      >
        {confirmAction?.status === "approved" && (
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Wire Date <span className="text-red-500">*</span>
            </label>
            <DatePickerField
              value={bulkWireDate}
              onChange={setBulkWireDate}
              placeholder="Select wire date"
              required
              ariaLabel="Bulk approval wire date"
            />
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
