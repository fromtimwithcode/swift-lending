"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { SearchInput } from "@/components/dashboard/search-input";
import { Loader2, Percent } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { PageSkeleton } from "@/components/dashboard/skeleton";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";

export default function AdminSettingsPage() {
  const borrowers = useQuery(api.users.getAllBorrowers);
  const investors = useQuery(api.users.getAllInvestors);
  const adminSettings = useQuery(api.settings.getAdminSettings);
  const toggleActive = useMutation(api.users.toggleUserActive);
  const updateDefaultInterestRate = useMutation(api.settings.updateDefaultInterestRate);
  const [activeTab, setActiveTab] = useState<"borrowers" | "investors">(
    "borrowers"
  );
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState("");
  const [defaultInterestRateInput, setDefaultInterestRateInput] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

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

  if (borrowers === undefined || investors === undefined || adminSettings === undefined) {
    return <PageSkeleton />;
  }

  const defaultInterestRateValue = defaultInterestRateInput ?? String(adminSettings.defaultInterestRate);
  const parsedDefaultInterestRate = Number(defaultInterestRateValue);
  const defaultInterestRateIsInvalid =
    defaultInterestRateValue.trim() === "" ||
    !Number.isFinite(parsedDefaultInterestRate) ||
    parsedDefaultInterestRate < adminSettings.minDefaultInterestRate ||
    parsedDefaultInterestRate > adminSettings.maxDefaultInterestRate;
  const normalizedDefaultInterestRate = Math.round(parsedDefaultInterestRate * 100) / 100;
  const defaultInterestRateChanged =
    !defaultInterestRateIsInvalid && normalizedDefaultInterestRate !== adminSettings.defaultInterestRate;

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

  const saveFinancialSettings = async () => {
    if (defaultInterestRateIsInvalid) {
      toast.error(
        `Enter a rate between ${adminSettings.minDefaultInterestRate}% and ${adminSettings.maxDefaultInterestRate}%`
      );
      return;
    }

    setSavingSettings(true);
    try {
      const result = await updateDefaultInterestRate({
        defaultInterestRate: parsedDefaultInterestRate,
      });
      setDefaultInterestRateInput(String(result.defaultInterestRate));
      toast.success("Financial settings updated");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update financial settings"));
    } finally {
      setSavingSettings(false);
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

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Percent className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Financial Settings</p>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Controls the default rate for new loan forms, borrower estimates, and dashboard cash-flow projection. Existing loans keep their saved rate.
              </p>
            </div>
          </div>
          <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground tabular-nums">
            {adminSettings.defaultInterestRateConfigured
              ? "Saved setting"
              : `${adminSettings.defaultInterestRateFallback}% fallback`}
          </span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,18rem)_1fr] md:items-end">
          <label className="block text-sm font-medium text-foreground">
            Default Annual Interest Rate
            <div className="relative mt-2">
              <input
                className="h-10 w-full rounded-lg border border-border bg-background px-3 pr-9 text-sm tabular-nums focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                type="number"
                min={adminSettings.minDefaultInterestRate}
                max={adminSettings.maxDefaultInterestRate}
                step="0.01"
                inputMode="decimal"
                value={defaultInterestRateValue}
                onChange={(e) => setDefaultInterestRateInput(e.target.value)}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                %
              </span>
            </div>
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Allowed range is {adminSettings.minDefaultInterestRate}% to {adminSettings.maxDefaultInterestRate}%. Cash flow uses current principal out: total loan minus remaining holdback.
            </p>
            <button
              type="button"
              onClick={saveFinancialSettings}
              disabled={!defaultInterestRateChanged || defaultInterestRateIsInvalid || savingSettings}
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-[background-color,color,opacity,transform] hover:bg-primary/90 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingSettings ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Save Settings"
              )}
            </button>
          </div>
        </div>

        {defaultInterestRateIsInvalid && (
          <p className="mt-3 text-xs text-destructive">
            Enter a rate between {adminSettings.minDefaultInterestRate}% and {adminSettings.maxDefaultInterestRate}%.
          </p>
        )}
      </div>
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
