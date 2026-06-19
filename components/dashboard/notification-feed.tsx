"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "./page-header";
import { Loader2, Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { EmptyState } from "./empty-state";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function NotificationFeed({ rolePrefix }: { rolePrefix: string }) {
  const notifications = useQuery(api.notifications.getMyNotifications);
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const router = useRouter();

  if (notifications === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const getLink = (n: { type: string; loanId?: Id<"loans">; drawRequestId?: Id<"drawRequests"> }) => {
    const base = `/dashboard/${rolePrefix}`;
    if (n.type === "message_received") return `${base}/messages`;
    if (n.type === "draw_submitted" && n.drawRequestId) {
      return rolePrefix === "admin"
        ? `/dashboard/admin/draws/${n.drawRequestId}`
        : `${base}/draws`;
    }
    if (n.type === "draw_reviewed" && n.drawRequestId) {
      return rolePrefix === "admin"
        ? `/dashboard/admin/draws/${n.drawRequestId}`
        : `${base}/draws`;
    }
    if (n.loanId) {
      return `${base}/loans/${n.loanId}`;
    }
    return null;
  };

  const handleClick = async (n: { _id: Id<"notifications">; isRead: boolean; type: string; loanId?: Id<"loans">; drawRequestId?: Id<"drawRequests"> }) => {
    if (!n.isRead) {
      await markAsRead({ id: n._id });
    }
    const link = getLink(n);
    if (link) router.push(link);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Stay updated on your activity"
        actions={
          notifications.some((n) => !n.isRead) ? (
            <button
              type="button"
              onClick={() => markAllRead()}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-[background-color,scale] hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.96]"
            >
              Mark All Read
            </button>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="When something needs your attention, it will appear here."
        />
      ) : (
        <div className="min-w-0 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_3px_oklch(0_0_0_/_4%)]">
          {notifications.map((n) => (
            <button
              key={n._id}
              type="button"
              onClick={() => handleClick(n)}
              className={`flex w-full min-w-0 items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30 sm:px-5 ${
                !n.isRead ? "border-l-4 border-l-primary" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="min-w-0 break-words text-sm font-medium [overflow-wrap:anywhere]">{n.title}</p>
                  {!n.isRead && (
                    <span className="size-2 rounded-full bg-primary" />
                  )}
                </div>
                <p className="mt-0.5 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  {n.body}
                </p>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {timeAgo(n._creationTime)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
