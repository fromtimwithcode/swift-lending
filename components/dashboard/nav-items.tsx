import type { ReactNode } from "react";
import {
  Activity,
  Bell,
  FileText,
  HandCoins,
  Landmark,
  LayoutDashboard,
  MessageSquare,
  PiggyBank,
  ShieldCheck,
  Users,
} from "lucide-react";

export interface NavItem {
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

const mobileNavHrefs: Record<string, string[]> = {
  admin: ["/dashboard/admin", "/dashboard/admin/loans", "/dashboard/admin/draws", "/dashboard/admin/messages"],
  developer: ["/dashboard/admin", "/dashboard/admin/loans", "/dashboard/admin/draws", "/dashboard/admin/messages"],
  borrower: ["/dashboard/borrower", "/dashboard/borrower/draws", "/dashboard/borrower/documents", "/dashboard/borrower/messages"],
  investor: ["/dashboard/investor", "/dashboard/investor/payments", "/dashboard/investor/statements", "/dashboard/investor/messages"],
};

export function getNavForRole(role: string): NavItem[] {
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

export function getMobileNavForRole(role: string): NavItem[] {
  const navItems = getNavForRole(role);
  const hrefs = mobileNavHrefs[role] ?? [];

  return hrefs
    .map((href) => navItems.find((item) => item.href === href))
    .filter((item): item is NavItem => Boolean(item));
}

export function isDashboardNavItemActive(pathname: string, href: string) {
  const rootPaths = ["/dashboard/admin", "/dashboard/borrower", "/dashboard/investor"];
  if (rootPaths.includes(href)) return pathname === href;
  return pathname.startsWith(href);
}
