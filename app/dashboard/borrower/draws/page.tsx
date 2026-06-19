"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { DrawDocumentFolders, type DrawFolderDraw } from "@/components/dashboard/draw-document-folders";
import { FileUploadDialog } from "@/components/dashboard/file-upload-dialog";
import { HandCoins, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { PageSkeleton } from "@/components/dashboard/skeleton";
import { type Id } from "@/convex/_generated/dataModel";

type TabFilter = "all" | "pending" | "under_review" | "approved" | "denied";

export default function BorrowerDrawsPage() {
  const draws = useQuery(api.borrower.getMyDrawRequests);
  const documents = useQuery(api.documents.getMyDocuments);
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [uploadDrawId, setUploadDrawId] = useState<Id<"drawRequests"> | undefined>();

  if (draws === undefined || documents === undefined) {
    return <PageSkeleton />;
  }

  const filtered = activeTab === "all"
    ? draws
    : draws.filter((d) => d.status === activeTab);

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
  const openDrawUpload = (draw: DrawFolderDraw) => setUploadDrawId(draw._id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Draw Requests"
        description="Request and track draw disbursements"
        actions={
          <Link
            href="/dashboard/borrower/draws/new"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 max-sm:w-full"
          >
            <Plus className="size-4" />
            New Draw Request
          </Link>
        }
      />

      {/* Tabs */}
      <div className="min-w-0 overflow-x-auto overscroll-x-contain border-b border-border touch-pan-x">
        <div className="flex min-w-max items-center gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`relative min-h-10 shrink-0 pb-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 ${
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
          description="Submit a draw request on an eligible loan."
          action={
            <Link
              href="/dashboard/borrower/draws/new"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 max-sm:w-full"
            >
              <Plus className="size-4" />
              New Draw Request
            </Link>
          }
        />
      )}

      {draws.length > 0 && (
        <DrawDocumentFolders
          draws={draws}
          documents={documents}
          title="Draw Document Folders"
          showProperty
          onUploadToDraw={openDrawUpload}
        />
      )}

      <FileUploadDialog
        open={uploadDrawId !== undefined}
        onClose={() => setUploadDrawId(undefined)}
        drawRequestId={uploadDrawId}
        drawOptions={draws}
        defaultDocType="receipt"
        title="Upload to Draw Folder"
        description="Add receipts, lien waivers, photos, or supporting files to this draw."
      />
    </div>
  );
}
