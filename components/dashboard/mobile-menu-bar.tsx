"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMobileNavForRole, isDashboardNavItemActive } from "@/components/dashboard/nav-items";

interface MobileMenuBarProps {
  role: string;
  moreOpen: boolean;
  messageUnreadCount?: number;
  notificationUnreadCount?: number;
  onMoreClick: () => void;
}

export function MobileMenuBar({
  role,
  moreOpen,
  messageUnreadCount,
  notificationUnreadCount,
  onMoreClick,
}: MobileMenuBarProps) {
  const pathname = usePathname();
  const navItems = getMobileNavForRole(role);
  const activePrimaryItem = navItems.some((item) => isDashboardNavItemActive(pathname, item.href));
  const moreActive = !activePrimaryItem;

  return (
    <nav
      aria-label="Primary mobile dashboard navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 shadow-[0_-8px_24px_oklch(0_0_0_/_5%)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {navItems.map((item) => {
          const active = isDashboardNavItemActive(pathname, item.href);
          const showMessageBadge = item.label === "Messages" && !!messageUnreadCount && messageUnreadCount > 0;
          const messageBadgeLabel = messageUnreadCount && messageUnreadCount > 99 ? "99+" : messageUnreadCount;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold transition-[background-color,color,scale] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.96]",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <span className="relative flex size-6 items-center justify-center" aria-hidden="true">
                {item.icon}
                {showMessageBadge && (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-background">
                    {messageBadgeLabel}
                  </span>
                )}
              </span>
              <span className="w-full truncate text-center leading-4">{shortLabel(item.label)}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onMoreClick}
          aria-label="Open full navigation menu"
          aria-controls="dashboard-sidebar"
          aria-expanded={moreOpen}
          className={cn(
            "relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold transition-[background-color,color,scale] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.96]",
            moreActive
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
        >
          <span className="relative flex size-6 items-center justify-center" aria-hidden="true">
            <Menu className="size-5" />
            {!!notificationUnreadCount && notificationUnreadCount > 0 && (
              <span className="absolute -right-1 -top-0.5 size-2.5 rounded-full bg-red-500 ring-2 ring-background" />
            )}
          </span>
          <span className="w-full truncate text-center leading-4">More</span>
        </button>
      </div>
    </nav>
  );
}

function shortLabel(label: string) {
  if (label === "Draw Requests") return "Draws";
  if (label === "My Loans") return "Loans";
  return label;
}
