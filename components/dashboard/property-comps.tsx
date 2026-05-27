"use client";

import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { DataTable, type Column } from "./data-table";
import { BarChart3, Loader2, MapPin, RefreshCw } from "lucide-react";
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
  const summary = useQuery(api.comps.getCompSummaryForLoan, { loanId });
  const fetchComps = useAction(api.comps.fetchComps);
  const router = useRouter();
  const [fetching, setFetching] = useState(false);

  const handleFetch = async () => {
    setFetching(true);
    try {
      const result = await fetchComps({ loanId });
      if (result.warning) {
        toast.warning(result.warning);
      } else {
        toast.success(`Fetched ${result.rentCastCount} RentCast and ${result.internalCount} internal comps`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to fetch comps. Please try again."));
    } finally {
      setFetching(false);
    }
  };

  const sourceLabel = (source: unknown) => {
    if (source === "rentcast_avm") return "RentCast Market";
    if (source === "internal_loan") return "Internal Loan";
    return String(source ?? "Unknown");
  };

  const sourceClass = (source: unknown) =>
    source === "rentcast_avm"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";

  const details = (row: Record<string, unknown>) => {
    const beds = typeof row.bedrooms === "number" ? `${row.bedrooms} bd` : null;
    const baths = typeof row.bathrooms === "number" ? `${row.bathrooms} ba` : null;
    const sqft = typeof row.sqft === "number" ? `${row.sqft.toLocaleString()} sqft` : null;
    return [beds, baths, sqft].filter(Boolean).join(" / ") || "—";
  };

  const columns: Column<Record<string, unknown>>[] = [
    { key: "address", header: "Address", sortable: true },
    {
      key: "salePrice",
      header: "Price",
      sortable: true,
      render: (row) => formatCurrency(row.salePrice as number),
    },
    {
      key: "saleDate",
      header: "Listing Date",
      sortable: true,
    },
    {
      key: "listingStatus",
      header: "Status",
      sortable: true,
      render: (row) => (row.listingStatus as string | undefined) ?? "—",
      className: "hidden md:table-cell",
    },
    {
      key: "sqft",
      header: "Details",
      sortable: true,
      render: details,
      className: "hidden lg:table-cell",
    },
    {
      key: "distanceMiles",
      header: "Distance",
      sortable: true,
      render: (row) => typeof row.distanceMiles === "number" ? `${(row.distanceMiles as number).toFixed(2)} mi` : "—",
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
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${sourceClass(row.source)}`}>
          {sourceLabel(row.source)}
        </span>
      ),
      className: "hidden md:table-cell",
    },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_12px_32px_rgba(0,0,0,0.04)]">
      <div className="mb-4 flex items-center justify-between">
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
          {summary && (
            <div className="mb-4 rounded-xl border border-border bg-muted/25 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <BarChart3 className="size-4 text-primary" />
                RentCast Value Estimate
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Estimated Value</p>
                  <p className="font-semibold tabular-nums">
                    {summary.estimatedValue ? formatCurrency(summary.estimatedValue) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Range</p>
                  <p className="font-semibold tabular-nums">
                    {summary.priceRangeLow && summary.priceRangeHigh
                      ? `${formatCurrency(summary.priceRangeLow)} - ${formatCurrency(summary.priceRangeHigh)}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Subject</p>
                  <p className="font-semibold">
                    {[summary.subjectPropertyType, summary.sqft ? `${summary.sqft.toLocaleString()} sqft` : undefined]
                      .filter(Boolean)
                      .join(" / ") || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last Sale</p>
                  <p className="font-semibold tabular-nums">
                    {summary.lastSalePrice ? formatCurrency(summary.lastSalePrice) : "—"}
                    {summary.lastSaleDate ? ` (${summary.lastSaleDate})` : ""}
                  </p>
                </div>
              </div>
            </div>
          )}
          <p className="mb-3 text-xs text-muted-foreground text-pretty">
            RentCast market comps are ranked by RentCast correlation. Internal loan comps are ranked from Swift records by location, price, ARV, rehab budget, status, and recency.
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
          No comps available yet. Click &quot;Fetch Comps&quot; to pull RentCast market comps and comparable Swift loans.
        </p>
      )}
    </div>
  );
}
