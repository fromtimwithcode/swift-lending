"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TrendingUp, DollarSign, Calendar, Wallet } from "lucide-react";
import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/format";
import { staggerContainer } from "@/lib/animations";
import { PageSkeleton } from "@/components/dashboard/skeleton";
import { formatCalendarDay } from "@/convex/lib/investmentSchedule";
import { getPortfolioRows, type PortfolioRow } from "@/lib/investor-portfolio";
import { useBusinessToday } from "@/hooks/use-business-today";

export default function InvestorDashboardPage() {
  const today = useBusinessToday();
  const portfolio = useQuery(api.investments.getMyPortfolio, { today });

  if (portfolio === undefined) {
    return <PageSkeleton />;
  }

  const { totals } = portfolio;
  const rows = getPortfolioRows(portfolio);

  const columns: Column<PortfolioRow>[] = [
    {
      key: "investmentAmount",
      header: "Amount",
      sortable: true,
      render: (row) => formatCurrency(row.investmentAmount),
    },
    {
      key: "interestRate",
      header: "Rate",
      sortable: true,
      render: (row) => `${row.interestRate}%`,
    },
    {
      key: "inceptionDate",
      header: "Inception",
      sortable: true,
      render: (row) => formatCalendarDay(row.inceptionDate),
      className: "hidden sm:table-cell",
    },
    {
      key: "monthlyPayment",
      header: "Monthly Payment",
      sortable: true,
      render: (row) => formatCurrency(row.monthlyPayment),
    },
    {
      key: "nextPaymentDate",
      header: "Next Payment",
      sortable: true,
      render: (row) => row.nextPaymentLabel,
    },
    {
      key: "interestEarned",
      header: "Interest Earned",
      sortable: true,
      render: (row) => formatCurrency(row.interestEarned),
      className: "hidden md:table-cell",
    },
    {
      key: "paidToDate",
      header: "Received",
      sortable: true,
      render: (row) => formatCurrency(row.paidToDate),
      className: "hidden md:table-cell",
    },
    {
      key: "notes",
      header: "Notes",
      render: (row) => (
        <span className="block max-w-[200px] truncate">{row.notes || "—"}</span>
      ),
      className: "hidden lg:table-cell",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolio"
        description="Track your investments and returns"
      />

      <motion.div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <KpiCard
          label="Total Invested"
          value={formatCurrency(totals.totalInvested)}
          subtitle={`Avg rate ${totals.avgInterestRate.toFixed(2)}%`}
          icon={DollarSign}
        />
        <KpiCard
          label="Interest Earned"
          value={formatCurrency(totals.interestEarned)}
          subtitle="Since inception"
          icon={TrendingUp}
        />
        <KpiCard
          label="Payments Received"
          value={formatCurrency(totals.paidToDate)}
          subtitle={
            totals.unpaidInterest > 0
              ? `${formatCurrency(totals.unpaidInterest)} earned, not yet paid`
              : "All earned interest paid"
          }
          icon={Wallet}
        />
        <KpiCard
          label="Next Payment"
          value={totals.nextPayment ? formatCurrency(totals.nextPayment.amount) : "None"}
          subtitle={
            totals.nextPayment
              ? totals.nextPayment.dueDate === portfolio.today
                ? "Due today"
                : `Due ${formatCalendarDay(totals.nextPayment.dueDate)}`
              : "No payments scheduled"
          }
          icon={Calendar}
        />
      </motion.div>

      {rows.length > 0 ? (
        <DataTable
          data={rows}
          columns={columns}
        />
      ) : (
        <EmptyState
          icon={TrendingUp}
          title="No investments yet"
          description="Your investments will appear here once your fund manager adds them."
        />
      )}
    </div>
  );
}
