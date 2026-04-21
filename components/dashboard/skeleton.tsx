import { cn } from "@/lib/utils";

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function KpiCardSkeleton() {
  return (
    <div className="card-premium p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="size-8 rounded-lg" />
      </div>
      <div className="mt-4">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="mt-2 h-3.5 w-36" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 shadow-[0_1px_3px_oklch(0_0_0_/_3%)]">
      {/* Header */}
      <div className="flex gap-4 border-b border-border/40 bg-muted/30 px-4 py-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 border-b border-border/40 last:border-0 px-4 py-3.5"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>

      {/* KPI grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </div>

      {/* Table */}
      <TableSkeleton />
    </div>
  );
}

export function DetailPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Back + header */}
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-8 w-56" />

      {/* Cards */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="card-premium p-6 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-5 w-44" />
        </div>
        <div className="card-premium p-6 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-5 w-44" />
        </div>
      </div>

      {/* Table */}
      <TableSkeleton rows={3} />
    </div>
  );
}

export { Skeleton };
