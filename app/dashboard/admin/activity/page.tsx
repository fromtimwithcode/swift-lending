"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useMemo } from "react";
import { StatusTabFilter } from "@/components/dashboard/status-tab-filter";
import { SearchInput } from "@/components/dashboard/search-input";
import { ACTIVITY_ACTION_LABELS, ENTITY_TYPE_LABELS } from "@/convex/lib/constants";
import { PageSkeleton } from "@/components/dashboard/skeleton";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

const ENTITY_TABS = [
  { label: "All", value: "all" },
  { label: "Loan", value: "loan" },
  { label: "Draw", value: "draw" },
  { label: "User", value: "user" },
  { label: "Investment", value: "investment" },
  { label: "Payment", value: "payment" },
  { label: "Document", value: "document" },
];

export default function ActivityLogPage() {
  const [entityFilter, setEntityFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Always fetch all activity so tab counts stay accurate
  const activity = useQuery(api.activityLog.getRecentActivity, {});

  const filtered = useMemo(() => {
    if (!activity) return [];
    let results = activity;
    if (entityFilter !== "all") {
      results = results.filter((e) => e.entityType === entityFilter);
    }
    if (!search.trim()) return results;
    const q = search.toLowerCase();
    return results.filter(
      (entry) =>
        entry.userName.toLowerCase().includes(q) ||
        (entry.details ?? "").toLowerCase().includes(q) ||
        (ACTIVITY_ACTION_LABELS[entry.action] ?? entry.action).toLowerCase().includes(q)
    );
  }, [activity, entityFilter, search]);

  if (activity === undefined) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
        <p className="text-sm text-muted-foreground">
          Track all actions performed across the platform.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <StatusTabFilter
          tabs={ENTITY_TABS.map((t) => ({
            ...t,
            count:
              t.value === "all"
                ? activity.length
                : activity.filter((e) => e.entityType === t.value).length,
          }))}
          activeTab={entityFilter}
          onChange={setEntityFilter}
        />
        <div className="w-full sm:w-64">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search activity..."
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">
            {search.trim()
              ? "No activity matching your search."
              : "No activity recorded yet."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    User
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr
                    key={entry._id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {timeAgo(entry._creationTime)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium">
                      {entry.userName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {ACTIVITY_ACTION_LABELS[entry.action] ?? entry.action}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {ENTITY_TYPE_LABELS[entry.entityType] ?? entry.entityType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-md truncate">
                      {entry.details ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
