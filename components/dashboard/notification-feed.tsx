"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "./page-header";
import { Loader2, Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";

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
              onClick={() => markAllRead()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            >
              Mark All Read
            </button>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card py-16">
          <Bell className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No notifications yet</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {notifications.map((n) => (
            <button
              key={n._id}
              onClick={() => handleClick(n)}
              className={`flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/50 ${
                !n.isRead ? "border-l-4 border-l-primary" : ""
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{n.title}</p>
                  {!n.isRead && (
                    <span className="size-2 rounded-full bg-primary" />
                  )}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {n.body}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
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
