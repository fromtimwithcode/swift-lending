"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SearchInput } from "@/components/dashboard/search-input";
import { ExportButton } from "@/components/dashboard/export-button";
import { BulkActionBar } from "@/components/dashboard/bulk-action-bar";
import { Users, Plus, UserCheck, UserX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo, useCallback, useEffect } from "react";
import { formatCurrency } from "@/lib/format";
import { PageSkeleton } from "@/components/dashboard/skeleton";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";

export default function AdminInvestorsPage() {
  const investors = useQuery(api.users.getAllInvestors);
  const bulkToggle = useMutation(api.users.bulkToggleActive);
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ title: string; action: () => Promise<void> } | null>(null);

  const filtered = useMemo(() => {
    if (!investors) return [];
    if (!search) return investors;
    const q = search.toLowerCase();
    return investors.filter(
      (i) =>
        i.displayName.toLowerCase().includes(q) ||
        i.email.toLowerCase().includes(q) ||
        (i.company?.toLowerCase().includes(q) ?? false)
    );
  }, [investors, search]);

  const handleSearch = useCallback((v: string) => setSearch(v), []);

  // Clear selections when filters change so bulk ops don't act on hidden rows
  useEffect(() => {
    setSelectedIds(new Set());
  }, [search]);

  if (investors === undefined) {
    return <PageSkeleton />;
  }

  const columns: Column<(typeof investors)[number]>[] = [
    { key: "displayName", header: "Name", sortable: true },
    {
      key: "company",
      header: "Company",
      sortable: true,
      render: (row) => row.company ?? "—",
    },
    { key: "email", header: "Email", sortable: true },
    {
      key: "phone",
      header: "Phone",
      render: (row) => row.phone ?? "—",
      className: "hidden md:table-cell",
    },
    {
      key: "investmentCount",
      header: "Investments",
      sortable: true,
      render: (row) => (
        <span className="font-medium">{row.investmentCount}</span>
      ),
    },
    {
      key: "totalInvested",
      header: "Total Invested",
      sortable: true,
      render: (row) => formatCurrency(row.totalInvested),
      className: "hidden lg:table-cell",
    },
    {
      key: "isActive",
      header: "Status",
      render: (row) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            row.isActive
              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
              : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
          }`}
        >
          {row.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  const exportColumns = [
    { header: "Name", key: "displayName" },
    { header: "Company", key: "company" },
    { header: "Email", key: "email" },
    { header: "Phone", key: "phone" },
    { header: "Investments", key: "investmentCount" },
    { header: "Total Invested", key: "totalInvested" },
    { header: "Active", key: "isActive" },
  ];

  const handleBulkAction = (isActive: boolean) => {
    const label = isActive ? "Activate" : "Deactivate";
    setConfirmAction({
      title: `${label} ${selectedIds.size} investor(s)?`,
      action: async () => {
        const userIds = [...selectedIds] as Id<"userProfiles">[];
        setBulkLoading(true);
        try {
          const results = await bulkToggle({ userIds, isActive });
          const failures = results.filter((r: { success: boolean; error?: string }) => !r.success);
          if (failures.length > 0) {
            toast.warning(`${results.length - failures.length} succeeded, ${failures.length} skipped`);
          } else {
            toast.success(`${results.length} investor(s) updated`);
          }
          setSelectedIds(new Set());
        } catch {
          toast.error(`Bulk ${label.toLowerCase()} failed. Please try again.`);
        } finally {
          setBulkLoading(false);
          setConfirmAction(null);
        }
      },
    });
  };

  const handleBulkActivate = () => handleBulkAction(true);
  const handleBulkDeactivate = () => handleBulkAction(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Investors"
        description={`${investors.length} investor${investors.length !== 1 ? "s" : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <ExportButton
              data={filtered as unknown as Record<string, unknown>[]}
              columns={exportColumns}
              filename="investors"
              title="Investors Report"
            />
            <Link
              href="/dashboard/admin/investors/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            >
              <Plus className="size-4" />
              Add Investor
            </Link>
          </div>
        }
      />

      <SearchInput
        value={search}
        onChange={handleSearch}
        placeholder="Search by name, email, or company..."
      />

      {filtered.length > 0 ? (
        <DataTable
          data={filtered as unknown as Record<string, unknown>[]}
          columns={columns as Column<Record<string, unknown>>[]}
          onRowClick={(row) =>
            router.push(
              `/dashboard/admin/investors/${(row as unknown as { _id: string })._id}`
            )
          }
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      ) : (
        <EmptyState
          icon={Users}
          title={search ? "No investors match your search" : "No investors yet"}
          description={search ? "Try adjusting your search terms." : "Add your first investor to start managing investments."}
          action={
            !search ? (
              <Link
                href="/dashboard/admin/investors/new"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
              >
                <Plus className="size-4" />
                Add Investor
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
            label: "Activate",
            icon: <UserCheck className="size-3.5" />,
            onClick: handleBulkActivate,
          },
          {
            label: "Deactivate",
            icon: <UserX className="size-3.5" />,
            onClick: handleBulkDeactivate,
            variant: "destructive",
          },
        ]}
      />
      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction?.title ?? ""}
        confirmLabel="Confirm"
        loading={bulkLoading}
        onConfirm={() => confirmAction?.action()}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
