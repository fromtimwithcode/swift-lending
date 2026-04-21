"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { HandCoins, Plus } from "lucide-react";
import Link from "next/link";
import { useState, useMemo } from "react";
import { formatCurrency } from "@/lib/format";
import { PageSkeleton } from "@/components/dashboard/skeleton";

type TabFilter = "all" | "pending" | "under_review" | "approved" | "denied";

export default function BorrowerDrawsPage() {
  const draws = useQuery(api.borrower.getMyDrawRequests);
  const [activeTab, setActiveTab] = useState<TabFilter>("all");

  if (draws === undefined) {
    return <PageSkeleton />;
  }

  const filtered = useMemo(() => {
    if (activeTab === "all") return draws;
    return draws.filter((d) => d.status === activeTab);
  }, [draws, activeTab]);

  const tabs: { label: string; value: TabFilter; count: number }[] = [
    { label: "All", value: "all", count: draws.length },
    { label: "Pending", value: "pending", count: draws.filter((d) => d.status === "pending").length },
    { label: "Under Review", value: "under_review", count: draws.filter((d) => d.status === "under_review").length },
    { label: "Approved", value: "approved", count: draws.filter((d) => d.status === "approved").length },
    { label: "Denied", value: "denied", count: draws.filter((d) => d.status === "denied").length },
  ];

  const columns: Column<(typeof draws)[number]>[] = [
    {
      key: "propertyAddress",
      header: "Property",
      sortable: true,
      className: "max-w-[200px] truncate",
    },
    {
      key: "amountRequested",
      header: "Amount",
      sortable: true,
      render: (row) => formatCurrency(row.amountRequested),
    },
    { key: "workDescription", header: "Description" },
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
    {
      key: "adminNotes",
      header: "Notes",
      render: (row) => row.adminNotes || "—",
      className: "hidden lg:table-cell",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Draw Requests"
        description="Request and track draw disbursements"
        actions={
          <Link
            href="/dashboard/borrower/draws/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
          >
            <Plus className="size-4" />
            New Draw Request
          </Link>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`relative pb-3 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-muted-foreground">
              {tab.count}
            </span>
            {activeTab === tab.value && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <DataTable
          data={filtered as unknown as Record<string, unknown>[]}
          columns={columns as Column<Record<string, unknown>>[]}
        />
      ) : (
        <EmptyState
          icon={HandCoins}
          title="No draw requests"
          description="Submit a draw request on a funded loan."
          action={
            <Link
              href="/dashboard/borrower/draws/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            >
              <Plus className="size-4" />
              New Draw Request
            </Link>
          }
        />
      )}
    </div>
  );
}
