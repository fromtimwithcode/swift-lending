"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { DataTable, type Column } from "./data-table";
import { Loader2, MapPin, RefreshCw } from "lucide-react";
import { useState } from "react";
import { formatCurrency } from "@/lib/format";

interface PropertyCompsProps {
  loanId: Id<"loans">;
}

export function PropertyComps({ loanId }: PropertyCompsProps) {
  const comps = useQuery(api.comps.getCompsForLoan, { loanId });
  const fetchComps = useMutation(api.comps.fetchComps);
  const [fetching, setFetching] = useState(false);

  const handleFetch = async () => {
    setFetching(true);
    try {
      await fetchComps({ loanId });
    } catch {
      alert("Failed to fetch comps. Please try again.");
    } finally {
      setFetching(false);
    }
  };

  const columns: Column<Record<string, unknown>>[] = [
    { key: "address", header: "Address", sortable: true },
    {
      key: "salePrice",
      header: "Sale Price",
      sortable: true,
      render: (row) => formatCurrency(row.salePrice as number),
    },
    { key: "saleDate", header: "Sale Date", sortable: true },
    {
      key: "sqft",
      header: "Sqft",
      sortable: true,
      render: (row) => (row.sqft as number).toLocaleString(),
    },
    {
      key: "bedrooms",
      header: "Bed/Bath",
      render: (row) => `${row.bedrooms}/${row.bathrooms}`,
    },
    {
      key: "distanceMiles",
      header: "Distance",
      sortable: true,
      render: (row) => `${(row.distanceMiles as number).toFixed(1)} mi`,
    },
    { key: "yearBuilt", header: "Year Built", sortable: true },
    {
      key: "source",
      header: "Source",
      render: (row) => (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
          {row.source as string}
        </span>
      ),
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground">
            Property Comps
          </h3>
        </div>
        <button
          onClick={handleFetch}
          disabled={fetching}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
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
        <DataTable
          data={comps as unknown as Record<string, unknown>[]}
          columns={columns}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          No comps available. Click &quot;Fetch Comps&quot; to generate mock comparable properties.
        </p>
      )}
    </div>
  );
}
