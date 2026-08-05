"use client";

import { Menu, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationBell } from "./notification-bell";

interface TopbarProps {
  onMenuClick: () => void;
  rolePrefix: "admin" | "borrower" | "investor";
  notificationUnreadCount?: number;
}

const SEGMENT_LABELS: Record<string, string> = {
  admin: "Admin",
  borrower: "Borrower",
  investor: "Investor",
  loans: "Loans",
  draws: "Draw Requests",
  documents: "Documents",
  messages: "Messages",
  notifications: "Notifications",
  settings: "Settings",
  applications: "Applications",
  borrowers: "Borrowers",
  investors: "Investors",
  users: "Users",
  activity: "Activity Log",
  "calculation-guide": "Calculation Guide",
  payments: "Payments",
  statements: "Statements",
  apply: "Apply",
  new: "New",
};

function getPageContext(pathname: string) {
  const segments = pathname.split("/").filter(Boolean).slice(1);

  if (segments.length === 0) {
    return { eyebrow: "Dashboard", title: "Home" };
  }

  const [roleSegment, ...pageSegments] = segments;
  const role = SEGMENT_LABELS[roleSegment] ?? "Dashboard";
  const lastSegment = pageSegments.at(-1);

  if (!lastSegment) {
    return { eyebrow: "Dashboard", title: role === "Admin" ? "Overview" : role };
  }

  const title = SEGMENT_LABELS[lastSegment] ?? (lastSegment.length > 18 ? "Details" : lastSegment.replaceAll("-", " "));
  return { eyebrow: role, title };
}

export function Topbar({
  onMenuClick,
  rolePrefix,
  notificationUnreadCount,
}: TopbarProps) {
  const pathname = usePathname();
  const { eyebrow, title } = getPageContext(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-16 min-w-0 items-center gap-4 border-b border-border/50 bg-background/80 px-4 shadow-[0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-xl backdrop-saturate-150 sm:px-6 lg:px-8">
      {/* Mobile menu button */}
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
        className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-[background-color,color,scale] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.96] lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70 sm:block">
          {eyebrow}
        </p>
        <p className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">
          {title}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <NotificationBell
          rolePrefix={rolePrefix}
          unreadCount={notificationUnreadCount}
        />
        <Link
          href="/dashboard/settings"
          className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-[background-color,color,scale] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.96]"
          aria-label="Settings"
        >
          <Settings className="size-5" />
        </Link>
      </div>
    </header>
  );
}
