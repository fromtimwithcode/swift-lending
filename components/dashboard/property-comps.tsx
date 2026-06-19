"use client";

import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { DataTable, type Column } from "./data-table";
import { Loader2, MapPin, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";

interface PropertyCompsProps {
  loanId: Id<"loans">;
}

export function PropertyComps({ loanId }: PropertyCompsProps) {
  const comps = useQuery(api.comps.getCompsForLoan, { loanId });
  const fetchComps = useAction(api.comps.fetchComps);
  const router = useRouter();
  const [fetching, setFetching] = useState(false);

  const handleFetch = async () => {
    setFetching(true);
    try {
      const result = await fetchComps({ loanId });
      toast.success(
        result.internalCount > 0
          ? `Fetched ${result.internalCount} internal comp${result.internalCount === 1 ? "" : "s"}`
          : "No matching internal comps found"
      );
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to fetch comps. Please try again."));
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
      key: "loanAmount",
      header: "Loan Amount",
      sortable: true,
      render: (row) => typeof row.loanAmount === "number" ? formatCurrency(row.loanAmount as number) : "—",
      className: "hidden md:table-cell",
    },
    {
      key: "afterRepairValue",
      header: "ARV",
      sortable: true,
      render: (row) => typeof row.afterRepairValue === "number" ? formatCurrency(row.afterRepairValue as number) : "—",
      className: "hidden lg:table-cell",
    },
    {
      key: "rehabBudgetTotal",
      header: "Rehab",
      sortable: true,
      render: (row) => typeof row.rehabBudgetTotal === "number" ? formatCurrency(row.rehabBudgetTotal as number) : "—",
      className: "hidden xl:table-cell",
    },
    {
      key: "similarityScore",
      header: "Match",
      sortable: true,
      render: (row) => row.similarityScore ? <span className="tabular-nums">{row.similarityScore as number}%</span> : "—",
    },
  ];

  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_12px_32px_rgba(0,0,0,0.04)] sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <MapPin className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground text-balance">
            Property Comps
          </h3>
        </div>
        <button
          onClick={handleFetch}
          disabled={fetching}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-[background-color,scale] duration-150 hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.96] disabled:opacity-50 disabled:active:scale-100"
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
            Internal loan comps are ranked from Swift records by location, price, ARV, rehab budget, status, and recency.
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
          No comps available yet. Click &quot;Fetch Comps&quot; to find comparable Swift loans.
        </p>
      )}
    </div>
  );
}
