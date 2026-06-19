"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Landmark,
  LogOut,
  X,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRef } from "react";
import { getNavForRole, isDashboardNavItemActive } from "@/components/dashboard/nav-items";

const PREWARM_TTL_MS = 20_000;

function revealTextClass(collapsed: boolean, maxWidth: "max-w-40" | "max-w-44") {
  return cn(
    "min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
    collapsed
      ? "max-w-0 translate-x-1 opacity-0 blur-[2px]"
      : [maxWidth, "translate-x-0 opacity-100 blur-0 delay-100"]
  );
}

interface SidebarProps {
  role: string;
  displayName: string;
  email: string;
  homeHref: string;
  messageUnreadCount?: number;
  notificationUnreadCount?: number;
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({
  role,
  displayName,
  email,
  homeHref,
  messageUnreadCount,
  notificationUnreadCount,
  isOpen,
  onClose,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const convex = useConvex();
  const { signOut } = useAuthActions();
  const navItems = getNavForRole(role);
  const prewarmedAtRef = useRef<Map<string, number>>(new Map());

  const isActive = (href: string) => isDashboardNavItemActive(pathname, href);

  const prewarmHref = (href: string) => {
    const now = Date.now();
    const lastPrewarm = prewarmedAtRef.current.get(href) ?? 0;
    if (now - lastPrewarm < PREWARM_TTL_MS) return;

    prewarmedAtRef.current.set(href, now);
    router.prefetch(href);

    const extendSubscriptionFor = PREWARM_TTL_MS;
    switch (href) {
      case "/dashboard/admin":
        convex.prewarmQuery({ query: api.admin.getOverviewStats, args: {}, extendSubscriptionFor });
        convex.prewarmQuery({ query: api.loanPayments.getAdminPaymentReminders, args: {}, extendSubscriptionFor });
        break;
      case "/dashboard/admin/loans":
        convex.prewarmQuery({ query: api.admin.getLoans, args: {}, extendSubscriptionFor });
        break;
      case "/dashboard/admin/applications":
        convex.prewarmQuery({ query: api.admin.getApplications, args: {}, extendSubscriptionFor });
        break;
      case "/dashboard/admin/draws":
        convex.prewarmQuery({ query: api.draws.getAllDrawRequests, args: {}, extendSubscriptionFor });
        break;
      case "/dashboard/admin/users":
        convex.prewarmQuery({ query: api.users.getAllUsers, args: {}, extendSubscriptionFor });
        break;
      case "/dashboard/admin/borrowers":
        convex.prewarmQuery({ query: api.users.getAllBorrowers, args: {}, extendSubscriptionFor });
        break;
      case "/dashboard/admin/investors":
        convex.prewarmQuery({ query: api.users.getAllInvestors, args: {}, extendSubscriptionFor });
        break;
      case "/dashboard/admin/notifications":
      case "/dashboard/borrower/notifications":
      case "/dashboard/investor/notifications":
        convex.prewarmQuery({ query: api.notifications.getMyNotifications, args: {}, extendSubscriptionFor });
        break;
      case "/dashboard/admin/messages":
      case "/dashboard/borrower/messages":
      case "/dashboard/investor/messages":
        convex.prewarmQuery({ query: api.messages.getConversations, args: {}, extendSubscriptionFor });
        break;
      case "/dashboard/admin/activity":
        convex.prewarmQuery({ query: api.activityLog.getRecentActivity, args: {}, extendSubscriptionFor });
        break;
      case "/dashboard/borrower":
        convex.prewarmQuery({ query: api.borrower.getMyLoans, args: {}, extendSubscriptionFor });
        convex.prewarmQuery({ query: api.borrower.getMyDrawRequests, args: {}, extendSubscriptionFor });
        convex.prewarmQuery({ query: api.loanPayments.getMyPaymentReminders, args: {}, extendSubscriptionFor });
        break;
      case "/dashboard/borrower/apply":
        convex.prewarmQuery({ query: api.settings.getLoanDefaults, args: {}, extendSubscriptionFor });
        break;
      case "/dashboard/borrower/draws":
        convex.prewarmQuery({ query: api.borrower.getMyDrawRequests, args: {}, extendSubscriptionFor });
        convex.prewarmQuery({ query: api.documents.getMyDocuments, args: {}, extendSubscriptionFor });
        break;
      case "/dashboard/borrower/documents":
        convex.prewarmQuery({ query: api.documents.getMyDocuments, args: {}, extendSubscriptionFor });
        convex.prewarmQuery({ query: api.borrower.getMyDrawRequests, args: {}, extendSubscriptionFor });
        break;
      case "/dashboard/investor": {
        const nowMinute = Math.floor(Date.now() / 60_000) * 60_000;
        convex.prewarmQuery({ query: api.investor.getPortfolioDashboard, args: { now: nowMinute }, extendSubscriptionFor });
        break;
      }
      case "/dashboard/investor/payments":
        convex.prewarmQuery({ query: api.investor.getMyInvestments, args: {}, extendSubscriptionFor });
        break;
      case "/dashboard/investor/statements":
        convex.prewarmQuery({ query: api.investor.getInvestmentStatement, args: {}, extendSubscriptionFor });
        break;
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        id="dashboard-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden bg-sidebar shadow-[1px_0_0_0_var(--sidebar-border)] transition-[transform,width] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
          collapsed ? "w-16" : "w-64",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex h-16 items-center border-b border-sidebar-border/50 transition-[padding] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
            collapsed ? "justify-center px-2" : "justify-between px-4"
          )}
        >
          <Link
            href={homeHref}
            onFocus={() => prewarmHref(homeHref)}
            onPointerEnter={() => prewarmHref(homeHref)}
            onTouchStart={() => prewarmHref(homeHref)}
            className={cn(
              "flex min-h-10 min-w-0 items-center rounded-xl transition-[gap,width] duration-300 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 motion-reduce:transition-none",
              collapsed ? "size-10 justify-center gap-0" : "flex-1 justify-start gap-2"
            )}
            aria-label={collapsed ? "Swift Capital dashboard" : undefined}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary shadow-[0_2px_8px_oklch(0.30_0.10_250_/_25%)]">
              <Landmark className="size-4 text-primary-foreground" />
            </div>
            <span
              aria-hidden={collapsed}
              className={cn(
                revealTextClass(collapsed, "max-w-40"),
                "text-lg font-bold tracking-tight"
              )}
            >
              Swift Capital
            </span>
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Collapse sidebar"
              className="hidden size-10 items-center justify-center rounded-xl text-muted-foreground transition-[background-color,color,scale] hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/30 active:scale-[0.96] lg:inline-flex"
            >
              <ChevronsLeft className="size-4" />
            </button>
          )}
          {/* Mobile close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-[background-color,color,scale] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.96] lg:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        <div
          className={cn(
            "hidden overflow-hidden border-b border-sidebar-border/50 transition-[height,opacity,padding] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none lg:block",
            collapsed ? "h-14 px-3 py-2 opacity-100" : "h-0 px-3 py-0 opacity-0"
          )}
          aria-hidden={!collapsed}
        >
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            disabled={!collapsed}
            tabIndex={collapsed ? 0 : -1}
            className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-[background-color,color,scale] hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/30 active:scale-[0.96] disabled:pointer-events-none"
          >
            <ChevronsRight className="size-4" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => {
                    prewarmHref(item.href);
                    onClose();
                  }}
                  onFocus={() => prewarmHref(item.href)}
                  onPointerEnter={() => prewarmHref(item.href)}
                  onTouchStart={() => prewarmHref(item.href)}
                  aria-label={collapsed ? item.label : undefined}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-11 items-center overflow-hidden rounded-xl py-2.5 text-sm font-medium transition-[background-color,color,box-shadow,scale,padding,gap] duration-200 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/30 active:scale-[0.98] motion-reduce:transition-none",
                    isActive(item.href)
                      ? "bg-primary/8 text-primary shadow-[inset_0_1px_2px_oklch(0_0_0_/_3%)]"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    collapsed ? "justify-center gap-0 px-2" : "gap-3 px-3"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="flex size-5 shrink-0 items-center justify-center">
                    {item.icon}
                  </span>
                  <span
                    aria-hidden={collapsed}
                    className={revealTextClass(collapsed, "max-w-44")}
                  >
                    {item.label}
                  </span>
                  {item.label === "Messages" && messageUnreadCount !== undefined && messageUnreadCount > 0 && (
                    <span
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground",
                        collapsed ? "absolute right-1.5 top-1.5 size-2.5 text-transparent" : "ml-auto"
                      )}
                    >
                      {messageUnreadCount}
                    </span>
                  )}
                  {item.label === "Notifications" && notificationUnreadCount !== undefined && notificationUnreadCount > 0 && (
                    <span
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white",
                        collapsed ? "absolute right-1.5 top-1.5 size-2.5 text-transparent" : "ml-auto"
                      )}
                    >
                      {notificationUnreadCount}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* User info + sign out */}
        <div className="border-t border-sidebar-border/50 p-3">
          <div
            className={cn(
              "flex items-center gap-3 transition-[gap] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
              collapsed && "flex-col justify-center gap-2"
            )}
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 text-sm font-semibold text-primary ring-1 ring-primary/15">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div
              aria-hidden={collapsed}
              className={cn(
                "min-w-0 flex-1 overflow-hidden transition-[max-width,max-height,opacity,transform,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
                collapsed
                  ? "max-h-0 max-w-0 translate-x-1 opacity-0 blur-[2px]"
                  : "max-h-12 max-w-40 translate-x-0 opacity-100 blur-0 delay-100"
              )}
            >
              <p className="truncate whitespace-nowrap text-sm font-medium">{displayName}</p>
              <p className="truncate whitespace-nowrap text-xs text-muted-foreground">
                {email}
              </p>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-[background-color,color,scale] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.96]"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
