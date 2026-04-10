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
import { Users, Plus, Loader2, UserCheck, UserX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo, useCallback } from "react";

function formatCurrency(value: number): string {
  if (value === 0) return "$0";
  return "$" + value.toLocaleString();
}

export default function AdminBorrowersPage() {
  const borrowers = useQuery(api.users.getAllBorrowers);
  const bulkToggle = useMutation(api.users.bulkToggleActive);
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const filtered = useMemo(() => {
    if (!borrowers) return [];
    if (!search) return borrowers;
    const q = search.toLowerCase();
    return borrowers.filter(
      (b) =>
        b.displayName.toLowerCase().includes(q) ||
        b.email.toLowerCase().includes(q) ||
        (b.company?.toLowerCase().includes(q) ?? false)
    );
  }, [borrowers, search]);

  const handleSearch = useCallback((v: string) => setSearch(v), []);

  if (borrowers === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const columns: Column<(typeof borrowers)[number]>[] = [
    { key: "displayName", header: "Name", sortable: true },
    {
      key: "company",
      header: "Entity / LLC",
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
      key: "activeLoanCount",
      header: "Active Loans",
      sortable: true,
      render: (row) => (
        <span className="font-medium">{row.activeLoanCount}</span>
      ),
    },
    {
      key: "totalCapital",
      header: "Total Capital",
      sortable: true,
      render: (row) => formatCurrency(row.totalCapital),
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
    { header: "Entity / LLC", key: "company" },
    { header: "Email", key: "email" },
    { header: "Phone", key: "phone" },
    { header: "Active Loans", key: "activeLoanCount" },
    { header: "Total Capital", key: "totalCapital" },
    { header: "Active", key: "isActive" },
  ];

  const handleBulkActivate = async () => {
    if (!confirm(`Activate ${selectedIds.size} borrower(s)?`)) return;
    const userIds = [...selectedIds] as Id<"userProfiles">[];
    setBulkLoading(true);
    try {
      await bulkToggle({ userIds, isActive: true });
      setSelectedIds(new Set());
    } catch (e) {
      alert("Bulk activate failed. Please try again.");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDeactivate = async () => {
    if (!confirm(`Deactivate ${selectedIds.size} borrower(s)?`)) return;
    const userIds = [...selectedIds] as Id<"userProfiles">[];
    setBulkLoading(true);
    try {
      await bulkToggle({ userIds, isActive: false });
      setSelectedIds(new Set());
    } catch (e) {
      alert("Bulk deactivate failed. Please try again.");
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Borrowers"
        description={`${borrowers.length} borrower${borrowers.length !== 1 ? "s" : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <ExportButton
              data={filtered as unknown as Record<string, unknown>[]}
              columns={exportColumns}
              filename="borrowers"
              title="Borrowers Report"
            />
            <Link
              href="/dashboard/admin/borrowers/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            >
              <Plus className="size-4" />
              Add Borrower
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
              `/dashboard/admin/borrowers/${(row as unknown as { _id: string })._id}`
            )
          }
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      ) : (
        <EmptyState
          icon={Users}
          title="No borrowers yet"
          description="Add your first borrower to start creating loans."
          action={
            <Link
              href="/dashboard/admin/borrowers/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            >
              <Plus className="size-4" />
              Add Borrower
            </Link>
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
    </div>
  );
}
