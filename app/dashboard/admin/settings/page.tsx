"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { SearchInput } from "@/components/dashboard/search-input";
import { Loader2 } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { PageSkeleton } from "@/components/dashboard/skeleton";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { AppConfigurationEditor } from "@/components/dashboard/app-configuration-editor";

export default function AdminSettingsPage() {
  const borrowers = useQuery(api.users.getAllBorrowers);
  const investors = useQuery(api.users.getAllInvestors);
  const toggleActive = useMutation(api.users.toggleUserActive);
  const [activeTab, setActiveTab] = useState<"borrowers" | "investors">(
    "borrowers"
  );
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState("");

  const handleSearch = useCallback((v: string) => setSearch(v), []);

  const filteredBorrowers = useMemo(() => {
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

  const filteredInvestors = useMemo(() => {
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

  if (borrowers === undefined || investors === undefined) {
    return <PageSkeleton />;
  }

  const handleToggle = async (id: string, name: string, isActive: boolean) => {
    if (isActive) {
      setConfirmDeactivate({ id, name });
      return;
    }
    setTogglingId(id);
    try {
      await toggleActive({ id: id as Id<"userProfiles"> });
      toast.success(`${name} activated`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to toggle user status"));
    } finally {
      setTogglingId(null);
    }
  };

  const executeDeactivate = async () => {
    if (!confirmDeactivate) return;
    setTogglingId(confirmDeactivate.id);
    try {
      await toggleActive({ id: confirmDeactivate.id as Id<"userProfiles"> });
      toast.success(`${confirmDeactivate.name} deactivated`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to toggle user status"));
    } finally {
      setTogglingId(null);
      setConfirmDeactivate(null);
    }
  };

  const tabs = [
    { key: "borrowers" as const, label: "Borrowers", count: borrowers.length },
    { key: "investors" as const, label: "Investors", count: investors.length },
  ];

  const borrowerColumns: Column<(typeof borrowers)[number]>[] = [
    { key: "displayName", header: "Name", sortable: true },
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
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              row.isActive
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
            }`}
          >
            {row.isActive ? "Active" : "Inactive"}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggle(row._id, row.displayName, row.isActive);
            }}
            disabled={togglingId === row._id}
            className="inline-flex min-h-10 items-center justify-center rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
          >
            {togglingId === row._id ? (
              <Loader2 className="size-3 animate-spin" />
            ) : row.isActive ? (
              "Deactivate"
            ) : (
              "Activate"
            )}
          </button>
        </div>
      ),
    },
  ];

  const investorColumns: Column<(typeof investors)[number]>[] = [
    { key: "displayName", header: "Name", sortable: true },
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
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              row.isActive
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
            }`}
          >
            {row.isActive ? "Active" : "Inactive"}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggle(row._id, row.displayName, row.isActive);
            }}
            disabled={togglingId === row._id}
            className="inline-flex min-h-10 items-center justify-center rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
          >
            {togglingId === row._id ? (
              <Loader2 className="size-3 animate-spin" />
            ) : row.isActive ? (
              "Deactivate"
            ) : (
              "Activate"
            )}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage users and system configuration"
      />

      <AppConfigurationEditor />

      <div className="border-t border-border pt-6">
        <h2 className="text-lg font-semibold">Portal access</h2>
        <p className="mt-1 text-sm text-muted-foreground">Manage borrower and investor access.</p>
      </div>

      {/* Tabs */}
      <div className="relative min-w-0 overflow-x-auto overscroll-x-contain border-b border-border touch-pan-x">
        <div className="flex min-w-max gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setSearch("");
              }}
              className={`relative min-h-10 shrink-0 pb-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 ${
                activeTab === tab.key
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label} ({tab.count})
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      <SearchInput
        value={search}
        onChange={handleSearch}
        placeholder="Search by name, email, or company..."
      />

      {/* User Table */}
      {activeTab === "borrowers" ? (
        filteredBorrowers.length > 0 ? (
          <DataTable
            data={filteredBorrowers as unknown as Record<string, unknown>[]}
            columns={
              borrowerColumns as Column<Record<string, unknown>>[]
            }
          />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {search ? "No borrowers match your search" : "No borrowers"}
          </p>
        )
      ) : filteredInvestors.length > 0 ? (
        <DataTable
          data={filteredInvestors as unknown as Record<string, unknown>[]}
          columns={
            investorColumns as Column<Record<string, unknown>>[]
          }
        />
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {search ? "No investors match your search" : "No investors"}
        </p>
      )}

      <ConfirmDialog
        open={confirmDeactivate !== null}
        title={`Deactivate ${confirmDeactivate?.name ?? ""}?`}
        description="This user will lose access to the portal."
        confirmLabel="Deactivate"
        variant="destructive"
        loading={togglingId !== null}
        onConfirm={executeDeactivate}
        onCancel={() => setConfirmDeactivate(null)}
      />
    </div>
  );
}
