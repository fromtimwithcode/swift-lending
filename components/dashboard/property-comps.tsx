"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { DataTable, type Column } from "./data-table";
import { Loader2, MapPin, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";

interface PropertyCompsProps {
  loanId: Id<"loans">;
}

export function PropertyComps({ loanId }: PropertyCompsProps) {
  const comps = useQuery(api.comps.getCompsForLoan, { loanId });
  const fetchComps = useMutation(api.comps.fetchComps);
  const router = useRouter();
  const [fetching, setFetching] = useState(false);

  const handleFetch = async () => {
    setFetching(true);
    try {
      await fetchComps({ loanId });
    } catch {
      toast.error("Failed to fetch comps. Please try again.");
    } finally {
      setFetching(false);
    }
  };

  const columns: Column<Record<string, unknown>>[] = [
    { key: "address", header: "Address", sortable: true },
    {
      key: "salePrice",
      header: "Purchase Price",
      sortable: true,
      render: (row) => formatCurrency(row.salePrice as number),
    },
    {
      key: "saleDate",
      header: "Close Date",
      sortable: true,
    },
    {
      key: "afterRepairValue",
      header: "ARV",
      sortable: true,
      render: (row) => row.afterRepairValue ? formatCurrency(row.afterRepairValue as number) : "—",
      className: "hidden md:table-cell",
    },
    {
      key: "loanAmount",
      header: "Loan Amount",
      sortable: true,
      render: (row) => row.loanAmount ? formatCurrency(row.loanAmount as number) : "—",
      className: "hidden lg:table-cell",
    },
    {
      key: "rehabBudgetTotal",
      header: "Rehab",
      sortable: true,
      render: (row) => row.rehabBudgetTotal ? formatCurrency(row.rehabBudgetTotal as number) : "—",
      className: "hidden xl:table-cell",
    },
    {
      key: "similarityScore",
      header: "Match",
      sortable: true,
      render: (row) => row.similarityScore ? <span className="tabular-nums">{row.similarityScore as number}%</span> : "—",
    },
    {
      key: "source",
      header: "Source",
      render: (row) => (
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          {row.source === "internal_loan" ? "Internal Loan" : (row.source as string)}
        </span>
      ),
      className: "hidden md:table-cell",
    },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_12px_32px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground text-balance">
            Property Comps
          </h3>
        </div>
        <button
          onClick={handleFetch}
          disabled={fetching}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-[background-color,scale] duration-150 hover:bg-primary/80 active:scale-[0.96] disabled:opacity-50 disabled:active:scale-100"
        >
          {fetching ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          {comps && comps.length > 0 ? "Refresh Comps" : "Fetch Comps"}
        </button>
      </div>

      {comps === undefined ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : comps.length > 0 ? (
        <>
          <p className="mb-3 text-xs text-muted-foreground text-pretty">
            Comparable deals are ranked from existing Swift loan records by location, price, ARV, rehab budget, status, and recency.
          </p>
          <DataTable
            data={comps as unknown as Record<string, unknown>[]}
            columns={columns}
            onRowClick={(row) => {
              if (row.sourceLoanId) router.push(`/dashboard/admin/loans/${row.sourceLoanId as string}`);
            }}
          />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          No internal comps available yet. Click &quot;Fetch Comps&quot; to pull comparable Swift loans from Convex.
        </p>
      )}
    </div>
  );
}
