"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
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
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar shadow-[1px_0_0_0_var(--sidebar-border)] transition-all duration-300",
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
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary shadow-[0_2px_8px_oklch(0.45_0.24_264_/_25%)]">
                <Landmark className="size-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold tracking-tight">
                Swift Capital
              </span>
            </Link>
          )}
          {collapsed && (
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary shadow-[0_2px_8px_oklch(0.45_0.24_264_/_25%)]">
              <Landmark className="size-4 text-primary-foreground" />
            </div>
          )}
          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="lg:hidden rounded-xl p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    isActive(item.href)
                      ? "bg-primary/8 text-primary shadow-[inset_0_1px_2px_oklch(0_0_0_/_3%)]"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    collapsed && "justify-center px-2"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  {/* Active indicator pill */}
                  {isActive(item.href) && !collapsed && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-full"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  {item.icon}
                  {!collapsed && <span>{item.label}</span>}
                  {item.label === "Messages" &&
                    unreadCount !== undefined &&
                    unreadCount > 0 && (
                      <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {unreadCount}
                      </span>
                    )}
                  {item.label === "Notifications" &&
                    notifUnreadCount !== undefined &&
                    notifUnreadCount > 0 && (
                      <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
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
              collapsed && "justify-center"
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
                onClick={() => signOut()}
                className="rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Sign out"
              >
                <LogOut className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* Edge handle — click to toggle sidebar (desktop only) */}
        <button
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden lg:block absolute inset-y-0 right-0 w-1.5 z-10 cursor-col-resize bg-transparent transition-colors duration-150 hover:bg-primary/40 active:bg-primary/60"
        />
      </aside>
    </>
  );
}
