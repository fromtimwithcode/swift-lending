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
import { HandCoins, Loader2, Check, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useMemo, useCallback } from "react";

function formatCurrency(value: number): string {
  return "$" + value.toLocaleString();
}

type TabFilter = "all" | "pending" | "under_review" | "approved" | "denied";

export default function AdminDrawsPage() {
  const draws = useQuery(api.draws.getAllDrawRequests, {});
  const bulkReview = useMutation(api.draws.bulkReviewDrawRequests);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

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

  if (draws === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
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

  const handleBulkApprove = async () => {
    if (!confirm(`Approve ${selectedIds.size} draw request(s)?`)) return;
    const drawIds = [...selectedIds] as Id<"drawRequests">[];
    setBulkLoading(true);
    try {
      await bulkReview({ drawIds, status: "approved" });
      setSelectedIds(new Set());
    } catch (e) {
      alert("Bulk approve failed. Please try again.");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDeny = async () => {
    if (!confirm(`Deny ${selectedIds.size} draw request(s)?`)) return;
    const drawIds = [...selectedIds] as Id<"drawRequests">[];
    setBulkLoading(true);
    try {
      await bulkReview({ drawIds, status: "denied" });
      setSelectedIds(new Set());
    } catch (e) {
      alert("Bulk deny failed. Please try again.");
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Draw Requests"
        description={`${draws.length} total draw request${draws.length !== 1 ? "s" : ""}`}
        actions={
          <ExportButton
            data={filtered as unknown as Record<string, unknown>[]}
            columns={exportColumns}
            filename="draw-requests"
            title="Draw Requests Report"
          />
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
          title="No draw requests"
          description="Draw requests from borrowers will appear here."
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
    </div>
  );
}
