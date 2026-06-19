"use client";

import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, ChevronsUpDown, Inbox } from "lucide-react";
import { useState, useMemo, useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  className?: string;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  idKey?: string;
}

type SortDirection = "asc" | "desc" | null;

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  onRowClick,
  emptyMessage = "No data available",
  className,
  selectable = false,
  selectedIds,
  onSelectionChange,
  idKey = "_id",
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") {
        setSortKey(null);
        setSortDir(null);
      }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDir) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let comparison = 0;
      if (typeof aVal === "string" && typeof bVal === "string") {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal;
      }
      return sortDir === "desc" ? -comparison : comparison;
    });
  }, [data, sortKey, sortDir]);

  const allVisibleIds = useMemo(
    () => new Set(sortedData.filter((row) => row[idKey] != null).map((row) => String(row[idKey]))),
    [sortedData, idKey]
  );

  const allSelected = Boolean(
    selectable &&
    selectedIds &&
    allVisibleIds.size > 0 &&
    [...allVisibleIds].every((id) => selectedIds.has(id))
  );

  const someSelected = Boolean(
    selectable &&
    selectedIds &&
    [...allVisibleIds].some((id) => selectedIds.has(id))
  );

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = Boolean(someSelected && !allSelected);
  }, [allSelected, someSelected]);

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      const next = new Set(selectedIds);
      for (const id of allVisibleIds) {
        next.delete(id);
      }
      onSelectionChange(next);
    } else {
      const next = new Set(selectedIds);
      for (const id of allVisibleIds) {
        next.add(id);
      }
      onSelectionChange(next);
    }
  };

  const handleSelectRow = (rowId: string) => {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(rowId)) {
      next.delete(rowId);
    } else {
      next.add(rowId);
    }
    onSelectionChange(next);
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (!onRowClick) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("button,a,input,select,textarea")) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowClick(row);
    }
  };

  if (data.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/60 px-6 py-16 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
          <Inbox className="size-5" />
        </div>
        <p className="mt-4 text-sm font-semibold text-foreground">{emptyMessage}</p>
        <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground text-pretty">
          Try adjusting your search or filters if you expected to see records here.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_oklch(0_0_0_/_4%),0_8px_24px_oklch(0_0_0_/_2%)]",
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/35">
              {selectable && (
                <th className="w-11 px-4 py-3">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    aria-checked={someSelected && !allSelected ? "mixed" : Boolean(allSelected)}
                    onChange={handleSelectAll}
                    aria-label="Select all rows"
                    className="size-4 rounded border-border accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  />
                </th>
              )}
              {columns.map((col) => {
                const activeSort = sortKey === col.key ? sortDir : null;

                return (
                  <th
                    key={col.key}
                    aria-sort={
                      col.sortable
                        ? activeSort === "asc"
                          ? "ascending"
                          : activeSort === "desc"
                            ? "descending"
                            : "none"
                        : undefined
                    }
                    className={cn(
                      "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                      col.className
                    )}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col.key)}
                        className="inline-flex min-h-8 items-center gap-1 rounded-lg px-1.5 -ml-1.5 text-left transition-[background-color,color] hover:bg-background/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                      >
                        {col.header}
                        <span className="text-muted-foreground/50">
                          {activeSort === "asc" ? (
                            <ChevronUp className="size-3.5" />
                          ) : activeSort === "desc" ? (
                            <ChevronDown className="size-3.5" />
                          ) : (
                            <ChevronsUpDown className="size-3.5" />
                          )}
                        </span>
                      </button>
                    ) : (
                      <span>{col.header}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, i) => {
              const rowId = String(row[idKey]);
              const isSelected = selectable && selectedIds?.has(rowId);

              return (
                <tr
                  key={row[idKey] != null ? String(row[idKey]) : i}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={(event) => handleRowKeyDown(event, row)}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cn(
                    "border-b border-border/40 last:border-0 transition-[background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30",
                    onRowClick && "cursor-pointer hover:bg-muted/35 active:bg-muted/55",
                    isSelected && "bg-primary/5"
                  )}
                >
                  {selectable && (
                    <td className="w-11 px-4 py-4">
                      <input
                        type="checkbox"
                        checked={isSelected ?? false}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSelectRow(rowId);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Select row"
                        className="size-4 rounded border-border accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={cn("px-4 py-4 align-middle", col.className)}>
                      {col.render
                        ? col.render(row)
                        : (row[col.key] as ReactNode) ?? "\u2014"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
