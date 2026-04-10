"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

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

export function NotificationBell() {
  const unreadCount = useQuery(api.notifications.getUnreadCount);
  const notifications = useQuery(api.notifications.getMyNotifications);
  const me = useQuery(api.users.getMe);
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const rolePrefix = me?.role === "admin" ? "admin" : me?.role === "investor" ? "investor" : "borrower";

  const getLink = (n: { type: string; loanId?: string; drawRequestId?: string }) => {
    const base = `/dashboard/${rolePrefix}`;
    if (n.type === "message_received") return `${base}/messages`;
    if (n.type === "draw_reviewed" && n.drawRequestId) {
      return rolePrefix === "admin"
        ? `/dashboard/admin/draws/${n.drawRequestId}`
        : `${base}/draws`;
    }
    if (n.loanId) {
      return `${base}${rolePrefix === "admin" ? "/loans/" : "/loans/"}${n.loanId}`;
    }
    return `${base}/notifications`;
  };

  const handleClick = async (n: { _id: string; isRead: boolean; type: string; loanId?: string; drawRequestId?: string }) => {
    if (!n.isRead) {
      await markAsRead({ id: n._id as never });
    }
    setOpen(false);
    router.push(getLink(n));
  };

  const recent = (notifications ?? []).slice(0, 10);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell className="size-5" />
        {unreadCount !== undefined && unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount !== undefined && unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {recent.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                No notifications
              </p>
            ) : (
              recent.map((n) => (
                <button
                  key={n._id}
                  onClick={() => handleClick(n as never)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  {!n.isRead && (
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                  )}
                  {n.isRead && <span className="mt-1.5 size-2 shrink-0" />}
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {n.body}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {timeAgo(n._creationTime)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="border-t border-border px-4 py-2">
            <button
              onClick={() => {
                setOpen(false);
                router.push(`/dashboard/${rolePrefix}/notifications`);
              }}
              className="w-full text-center text-xs text-primary hover:underline"
            >
              View all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
