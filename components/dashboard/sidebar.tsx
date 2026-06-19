"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Landmark,
  FileText,
  HandCoins,
  Users,
  PiggyBank,
  MessageSquare,
  LogOut,
  X,
  Bell,
  Activity,
  ShieldCheck,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type ReactNode } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

const adminNav: NavItem[] = [
  {
    label: "Overview",
    href: "/dashboard/admin",
    icon: <LayoutDashboard className="size-5" />,
  },
  {
    label: "Loans",
    href: "/dashboard/admin/loans",
    icon: <Landmark className="size-5" />,
  },
  {
    label: "Applications",
    href: "/dashboard/admin/applications",
    icon: <FileText className="size-5" />,
  },
  {
    label: "Draw Requests",
    href: "/dashboard/admin/draws",
    icon: <HandCoins className="size-5" />,
  },
  {
    label: "Users",
    href: "/dashboard/admin/users",
    icon: <ShieldCheck className="size-5" />,
  },
  {
    label: "Borrowers",
    href: "/dashboard/admin/borrowers",
    icon: <Users className="size-5" />,
  },
  {
    label: "Investors",
    href: "/dashboard/admin/investors",
    icon: <PiggyBank className="size-5" />,
  },
  {
    label: "Notifications",
    href: "/dashboard/admin/notifications",
    icon: <Bell className="size-5" />,
  },
  {
    label: "Messages",
    href: "/dashboard/admin/messages",
    icon: <MessageSquare className="size-5" />,
  },
  {
    label: "Activity Log",
    href: "/dashboard/admin/activity",
    icon: <Activity className="size-5" />,
  },
];

const borrowerNav: NavItem[] = [
  {
    label: "My Loans",
    href: "/dashboard/borrower",
    icon: <Landmark className="size-5" />,
  },
  {
    label: "New Loan",
    href: "/dashboard/borrower/apply",
    icon: <FileText className="size-5" />,
  },
  {
    label: "Draw Requests",
    href: "/dashboard/borrower/draws",
    icon: <HandCoins className="size-5" />,
  },
  {
    label: "Documents",
    href: "/dashboard/borrower/documents",
    icon: <FileText className="size-5" />,
  },
  {
    label: "Notifications",
    href: "/dashboard/borrower/notifications",
    icon: <Bell className="size-5" />,
  },
  {
    label: "Messages",
    href: "/dashboard/borrower/messages",
    icon: <MessageSquare className="size-5" />,
  },
];

const investorNav: NavItem[] = [
  {
    label: "Portfolio",
    href: "/dashboard/investor",
    icon: <PiggyBank className="size-5" />,
  },
  {
    label: "Payments",
    href: "/dashboard/investor/payments",
    icon: <Landmark className="size-5" />,
  },
  {
    label: "Statements",
    href: "/dashboard/investor/statements",
    icon: <FileText className="size-5" />,
  },
  {
    label: "Notifications",
    href: "/dashboard/investor/notifications",
    icon: <Bell className="size-5" />,
  },
  {
    label: "Messages",
    href: "/dashboard/investor/messages",
    icon: <MessageSquare className="size-5" />,
  },
];

function getNavForRole(role: string): NavItem[] {
  switch (role) {
    case "admin":
    case "developer":
      return adminNav;
    case "borrower":
      return borrowerNav;
    case "investor":
      return investorNav;
    default:
      return [];
  }
}

interface SidebarProps {
  role: string;
  displayName: string;
  email: string;
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({
  role,
  displayName,
  email,
  isOpen,
  onClose,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const { signOut } = useAuthActions();
  const navItems = getNavForRole(role);
  const unreadCount = useQuery(api.messages.getUnreadCount);
  const notifUnreadCount = useQuery(api.notifications.getUnreadCount);

  const rootPaths = ["/dashboard/admin", "/dashboard/borrower", "/dashboard/investor"];
  const isActive = (href: string) => {
    if (rootPaths.includes(href)) return pathname === href;
    return pathname.startsWith(href);
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
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar shadow-[1px_0_0_0_var(--sidebar-border)] transition-[transform,width] duration-300",
          collapsed ? "w-16" : "w-64",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex h-16 items-center border-b border-sidebar-border/50 px-4",
            collapsed ? "justify-center" : "justify-between"
          )}
        >
          {!collapsed && (
            <Link
              href="/dashboard"
              className="flex min-h-10 items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary shadow-[0_2px_8px_oklch(0.30_0.10_250_/_25%)]">
                <Landmark className="size-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold tracking-tight">
                Swift Capital
              </span>
            </Link>
          )}
          {collapsed && (
            <Link
              href="/dashboard"
              className="flex size-10 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              aria-label="Swift Capital dashboard"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary shadow-[0_2px_8px_oklch(0.30_0.10_250_/_25%)]">
                <Landmark className="size-4 text-primary-foreground" />
              </div>
            </Link>
          )}
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

        {collapsed && (
          <div className="hidden border-b border-sidebar-border/50 px-3 py-2 lg:block">
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Expand sidebar"
              className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-[background-color,color,scale] hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/30 active:scale-[0.96]"
            >
              <ChevronsRight className="size-4" />
            </button>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  aria-label={collapsed ? item.label : undefined}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-[background-color,color,box-shadow,scale] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/30 active:scale-[0.98]",
                    isActive(item.href)
                      ? "bg-primary/8 text-primary shadow-[inset_0_1px_2px_oklch(0_0_0_/_3%)]"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    collapsed && "justify-center px-2"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  {item.icon}
                  {!collapsed && <span>{item.label}</span>}
                  {item.label === "Messages" && unreadCount !== undefined && unreadCount > 0 && (
                    <span
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground",
                        collapsed ? "absolute right-1.5 top-1.5 size-2.5 text-transparent" : "ml-auto"
                      )}
                    >
                      {unreadCount}
                    </span>
                  )}
                  {item.label === "Notifications" && notifUnreadCount !== undefined && notifUnreadCount > 0 && (
                    <span
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white",
                        collapsed ? "absolute right-1.5 top-1.5 size-2.5 text-transparent" : "ml-auto"
                      )}
                    >
                      {notifUnreadCount}
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
              "flex items-center gap-3",
              collapsed && "flex-col justify-center gap-2"
            )}
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 text-sm font-semibold text-primary ring-1 ring-primary/15">
              {displayName.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {email}
                </p>
              </div>
            )}
            {!collapsed && (
              <button
                type="button"
                onClick={() => signOut()}
                className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-[background-color,color,scale] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.96]"
                aria-label="Sign out"
              >
                <LogOut className="size-4" />
              </button>
            )}
            {collapsed && (
              <button
                type="button"
                onClick={() => signOut()}
                className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-[background-color,color,scale] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.96]"
                aria-label="Sign out"
              >
                <LogOut className="size-4" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
