"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Landmark, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/format";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { PageSkeleton } from "@/components/dashboard/skeleton";

export default function BorrowerDashboardPage() {
  const loans = useQuery(api.borrower.getMyLoans);
  const draws = useQuery(api.borrower.getMyDrawRequests);
  const router = useRouter();

  if (loans === undefined) {
    return <PageSkeleton />;
  }

  const activeLoans = loans.filter(
    (l) => l.status !== "closed" && l.status !== "denied"
  );
  const totalBorrowed = loans.reduce((sum, l) => sum + l.loanAmount, 0);
  const pendingDraws = draws?.filter((d) => d.status === "pending").length ?? 0;

  const kpis = [
    { label: "Active Loans", value: activeLoans.length },
    { label: "Total Borrowed", value: formatCurrency(totalBorrowed) },
    { label: "Pending Draws", value: pendingDraws },
  ];

  const columns: Column<(typeof loans)[number]>[] = [
    {
      key: "propertyAddress",
      header: "Property",
      sortable: true,
      className: "max-w-[200px] truncate",
    },
    {
      key: "loanAmount",
      header: "Loan Amount",
      sortable: true,
      render: (row) => formatCurrency(row.loanAmount),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "terms",
      header: "Terms",
      sortable: true,
      className: "hidden md:table-cell",
    },
    {
      key: "interestRate",
      header: "Rate",
      sortable: true,
      render: (row) => (row.interestRate ? `${row.interestRate}%` : "—"),
      className: "hidden lg:table-cell",
    },
    {
      key: "closeDate",
      header: "Close Date",
      sortable: true,
      render: (row) => row.closeDate ?? "—",
      className: "hidden md:table-cell",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Loans"
        description="View and manage your loan applications"
        actions={
          <Link
            href="/dashboard/borrower/apply"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
          >
            <Plus className="size-4" />
            Apply for Loan
          </Link>
        }
      />

      {/* KPI Cards */}
      <motion.div
        className="grid gap-4 sm:grid-cols-3"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {kpis.map((kpi) => (
          <motion.div
            key={kpi.label}
            variants={staggerItem}
            className="rounded-xl border border-border bg-card p-5"
          >
            <p className="text-sm text-muted-foreground">{kpi.label}</p>
            <p className="mt-1 text-2xl font-bold">{kpi.value}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Loans Table */}
      {loans.length > 0 ? (
        <DataTable
          data={loans as unknown as Record<string, unknown>[]}
          columns={columns as Column<Record<string, unknown>>[]}
          onRowClick={(row) =>
            router.push(
              `/dashboard/borrower/loans/${(row as unknown as { _id: string })._id}`
            )
          }
        />
      ) : (
        <EmptyState
          icon={Landmark}
          title="No loans yet"
          description="Apply for your first loan to get started."
          action={
            <Link
              href="/dashboard/borrower/apply"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            >
              <Plus className="size-4" />
              Apply for Loan
            </Link>
          }
        />
      )}
    </div>
  );
}
