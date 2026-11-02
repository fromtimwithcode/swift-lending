"use client";

import { useMutation, useQuery } from "convex/react";
import { Building2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { SearchInput } from "@/components/dashboard/search-input";
import { PageSkeleton } from "@/components/dashboard/skeleton";
import { TitleCompanyFormDialog } from "@/components/dashboard/title-company-dialogs";

const addButtonClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export default function AdminTitleCompaniesPage() {
  const companies = useQuery(api.titleCompanies.list);
  const create = useMutation(api.titleCompanies.create);
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);

  const handleSearch = useCallback((value: string) => setSearch(value), []);

  const filtered = useMemo(() => {
    if (!companies) return [];
    if (!search) return companies;
    const query = search.toLowerCase();
    const digits = query.replace(/\D/g, "");
    return companies.filter(
      (company) =>
        company.name.toLowerCase().includes(query) ||
        (company.email?.toLowerCase().includes(query) ?? false) ||
        (company.phone?.toLowerCase().includes(query) ?? false) ||
        (digits.length > 0 && (company.phone?.replace(/\D/g, "").includes(digits) ?? false))
    );
  }, [companies, search]);

  if (companies === undefined) {
    return <PageSkeleton />;
  }

  const openAdd = (element: HTMLElement) => {
    trigger.current = element;
    setAdding(true);
  };

  const columns: Column<(typeof companies)[number]>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      render: (row) => (
        <span className="block max-w-72 whitespace-normal break-words sm:max-w-xs">
          <span className="font-semibold">{row.name}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">
            {row.phone && <span className="tabular-nums">{row.phone} · </span>}
            {row.hasWireInstructions ? "Wire instructions on file" : "No wire instructions"}
          </span>
        </span>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      render: (row) => <span className="tabular-nums">{row.phone ?? "—"}</span>,
      className: "hidden sm:table-cell",
    },
    {
      key: "email",
      header: "Email",
      sortable: true,
      render: (row) => row.email ?? "—",
      className: "hidden xl:table-cell",
    },
    {
      key: "contactCount",
      header: "Contacts",
      sortable: true,
      render: (row) => <span className="font-medium tabular-nums">{row.contactCount}</span>,
      className: "hidden md:table-cell",
    },
    {
      key: "hasWireInstructions",
      header: "Wire instructions",
      render: (row) =>
        row.hasWireInstructions ? (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
            On file
          </span>
        ) : (
          <span className="text-muted-foreground">Not on file</span>
        ),
      className: "hidden sm:table-cell",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Title Companies"
        description={`${companies.length} title compan${companies.length === 1 ? "y" : "ies"}`}
        actions={
          <button
            type="button"
            onClick={(event) => openAdd(event.currentTarget)}
            className={`${addButtonClassName} max-sm:flex-1`}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add Title Company
          </button>
        }
      />

      <SearchInput
        value={search}
        onChange={handleSearch}
        placeholder="Search by name, phone, or email..."
      />

      {filtered.length > 0 ? (
        <DataTable
          data={filtered as unknown as Record<string, unknown>[]}
          columns={columns as Column<Record<string, unknown>>[]}
          onRowClick={(row) =>
            router.push(`/dashboard/admin/title-companies/${(row as unknown as { _id: string })._id}`)
          }
        />
      ) : (
        <EmptyState
          icon={Building2}
          title={search ? "No title companies match your search" : "No title companies yet"}
          description={
            search
              ? "Try a different name, phone number, or email."
              : "Keep each title company's contacts and wire instructions in one place."
          }
          action={
            !search ? (
              <button
                type="button"
                onClick={(event) => openAdd(event.currentTarget)}
                className={addButtonClassName}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add Title Company
              </button>
            ) : undefined
          }
        />
      )}

      {adding && (
        <TitleCompanyFormDialog
          company={null}
          onSave={async (values) => {
            const id = await create(values);
            toast.success("Title company added");
            router.push(`/dashboard/admin/title-companies/${id}`);
          }}
          onClose={() => setAdding(false)}
          finalFocus={() => (trigger.current?.isConnected ? trigger.current : null)}
        />
      )}
    </div>
  );
}
