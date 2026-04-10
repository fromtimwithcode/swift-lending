"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SearchInput } from "@/components/dashboard/search-input";
import { StatusTabFilter } from "@/components/dashboard/status-tab-filter";
import { ExportButton } from "@/components/dashboard/export-button";
import { FileText, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useMemo, useCallback } from "react";

function formatCurrency(value: number): string {
  return "$" + value.toLocaleString();
}

type TabFilter = "all" | "submitted" | "under_review" | "additional_info_needed";

export default function AdminApplicationsPage() {
  const applications = useQuery(api.admin.getApplications);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!applications) return [];

    let result = [...applications];

    if (activeTab !== "all") {
      result = result.filter((a) => a.status === activeTab);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.borrowerName.toLowerCase().includes(q) ||
          a.propertyAddress.toLowerCase().includes(q) ||
          a.entityName.toLowerCase().includes(q)
      );
    }

    return result;
  }, [applications, activeTab, search]);

  const handleSearch = useCallback((v: string) => setSearch(v), []);

  if (applications === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const tabs = [
    { label: "All", value: "all", count: applications.length },
    {
      label: "Submitted",
      value: "submitted",
      count: applications.filter((a) => a.status === "submitted").length,
    },
    {
      label: "Under Review",
      value: "under_review",
      count: applications.filter((a) => a.status === "under_review").length,
    },
    {
      label: "Info Needed",
      value: "additional_info_needed",
      count: applications.filter((a) => a.status === "additional_info_needed").length,
    },
  ];

  const columns: Column<(typeof applications)[number]>[] = [
    { key: "borrowerName", header: "Borrower", sortable: true },
    { key: "entityName", header: "Entity", sortable: true, className: "hidden md:table-cell" },
    {
      key: "propertyAddress",
      header: "Property",
      sortable: true,
      className: "max-w-[200px] truncate",
    },
    {
      key: "loanAmount",
      header: "Amount",
      sortable: true,
      render: (row) => formatCurrency(row.loanAmount),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "_creationTime",
      header: "Submitted",
      sortable: true,
      render: (row) => new Date(row._creationTime).toLocaleDateString(),
      className: "hidden md:table-cell",
    },
  ];

  const exportColumns = [
    { header: "Borrower", key: "borrowerName" },
    { header: "Entity", key: "entityName" },
    { header: "Property", key: "propertyAddress" },
    { header: "Amount", key: "loanAmount" },
    { header: "Status", key: "status" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applications"
        description={`${applications.length} pending application${applications.length !== 1 ? "s" : ""}`}
        actions={
          <ExportButton
            data={filtered as unknown as Record<string, unknown>[]}
            columns={exportColumns}
            filename="applications"
            title="Applications Report"
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
        placeholder="Search by borrower, address, or entity..."
      />

      {filtered.length > 0 ? (
        <DataTable
          data={filtered as unknown as Record<string, unknown>[]}
          columns={columns as Column<Record<string, unknown>>[]}
          onRowClick={(row) =>
            router.push(
              `/dashboard/admin/loans/${(row as unknown as { _id: string })._id}`
            )
          }
        />
      ) : (
        <EmptyState
          icon={FileText}
          title="No pending applications"
          description="New loan applications from borrowers will appear here."
        />
      )}
    </div>
  );
}
