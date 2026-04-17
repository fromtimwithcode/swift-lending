"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SearchInput } from "@/components/dashboard/search-input";
import { StatusTabFilter } from "@/components/dashboard/status-tab-filter";
import { ExportButton } from "@/components/dashboard/export-button";
import { BulkActionBar } from "@/components/dashboard/bulk-action-bar";
import { ShieldCheck, Plus, UserCheck, UserX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo, useCallback, useEffect } from "react";
import { ROLE_LABELS } from "@/convex/lib/constants";
import { PageSkeleton } from "@/components/dashboard/skeleton";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";

export default function AdminUsersPage() {
  const users = useQuery(api.users.getAllUsers);
  const bulkToggle = useMutation(api.users.bulkToggleActive);
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [roleTab, setRoleTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ title: string; action: () => Promise<void> } | null>(null);

  const filtered = useMemo(() => {
    if (!users) return [];
    let result = users;

    // Role tab filter
    if (roleTab === "admins") {
      result = result.filter((u) => u.role === "admin" || u.role === "developer");
    } else if (roleTab === "borrowers") {
      result = result.filter((u) => u.role === "borrower");
    } else if (roleTab === "investors") {
      result = result.filter((u) => u.role === "investor");
    }

    // Status filter
    if (statusFilter === "active") {
      result = result.filter((u) => u.isActive);
    } else if (statusFilter === "inactive") {
      result = result.filter((u) => !u.isActive);
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.displayName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.company?.toLowerCase().includes(q) ?? false)
      );
    }

    return result;
  }, [users, roleTab, statusFilter, search]);

  const roleCounts = useMemo(() => {
    if (!users) return { all: 0, admins: 0, borrowers: 0, investors: 0 };
    return {
      all: users.length,
      admins: users.filter((u) => u.role === "admin" || u.role === "developer").length,
      borrowers: users.filter((u) => u.role === "borrower").length,
      investors: users.filter((u) => u.role === "investor").length,
    };
  }, [users]);

  const handleSearch = useCallback((v: string) => setSearch(v), []);

  // Clear selections when any filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, roleTab, statusFilter]);

  if (users === undefined) {
    return <PageSkeleton />;
  }

  const columns: Column<(typeof users)[number]>[] = [
    { key: "displayName", header: "Name", sortable: true },
    {
      key: "role",
      header: "Role",
      render: (row) => (
        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          {ROLE_LABELS[row.role] ?? row.role}
        </span>
      ),
    },
    { key: "email", header: "Email", sortable: true },
    {
      key: "company",
      header: "Company",
      render: (row) => row.company ?? "—",
      className: "hidden md:table-cell",
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
    { header: "Role", key: "role" },
    { header: "Email", key: "email" },
    { header: "Company", key: "company" },
    { header: "Phone", key: "phone" },
    { header: "Status", key: "isActive" },
  ];

  const handleBulkAction = (isActive: boolean) => {
    const label = isActive ? "Activate" : "Deactivate";
    setConfirmAction({
      title: `${label} ${selectedIds.size} user(s)?`,
      action: async () => {
        const userIds = [...selectedIds] as Id<"userProfiles">[];
        setBulkLoading(true);
        try {
          const results = await bulkToggle({ userIds, isActive });
          const failures = results.filter((r: { success: boolean; error?: string }) => !r.success);
          if (failures.length > 0) {
            toast.warning(`${results.length - failures.length} succeeded, ${failures.length} skipped`);
          } else {
            toast.success(`${results.length} user(s) updated`);
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

  const handleRowClick = (row: Record<string, unknown>) => {
    const user = row as unknown as (typeof users)[number];
    if (user.role === "borrower") {
      router.push(`/dashboard/admin/borrowers/${user._id}`);
    } else if (user.role === "investor") {
      router.push(`/dashboard/admin/investors/${user._id}`);
    }
    // No-op for admin/developer (no detail page)
  };

  const tabs = [
    { label: "All", value: "all", count: roleCounts.all },
    { label: "Admins", value: "admins", count: roleCounts.admins },
    { label: "Borrowers", value: "borrowers", count: roleCounts.borrowers },
    { label: "Investors", value: "investors", count: roleCounts.investors },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={`${users.length} user${users.length !== 1 ? "s" : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <ExportButton
              data={filtered as unknown as Record<string, unknown>[]}
              columns={exportColumns}
              filename="users"
              title="Users Report"
            />
            <Link
              href="/dashboard/admin/users/new"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            >
              <Plus className="size-4" />
              Add User
            </Link>
          </div>
        }
      />

      <StatusTabFilter tabs={tabs} activeTab={roleTab} onChange={setRoleTab} />

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={handleSearch}
            placeholder="Search by name, email, or company..."
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {filtered.length > 0 ? (
        <DataTable
          data={filtered as unknown as Record<string, unknown>[]}
          columns={columns as Column<Record<string, unknown>>[]}
          onRowClick={handleRowClick}
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      ) : (
        <EmptyState
          icon={ShieldCheck}
          title={search || roleTab !== "all" || statusFilter !== "all" ? "No users match your filters" : "No users yet"}
          description={search || roleTab !== "all" || statusFilter !== "all" ? "Try adjusting your search or filters." : "Add your first user to get started."}
          action={
            !search && roleTab === "all" && statusFilter === "all" ? (
              <Link
                href="/dashboard/admin/users/new"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
              >
                <Plus className="size-4" />
                Add User
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
