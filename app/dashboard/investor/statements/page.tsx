"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { DollarSign, TrendingUp, Percent, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { PageSkeleton } from "@/components/dashboard/skeleton";
import { motion } from "framer-motion";
import { staggerContainer } from "@/lib/animations";
import { formatCalendarDay } from "@/convex/lib/investmentSchedule";
import { getPortfolioRows, type PortfolioRow } from "@/lib/investor-portfolio";
import { useBusinessToday } from "@/hooks/use-business-today";

export default function InvestorStatementsPage() {
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
      render: (row) => formatCurrency(row.investmentAmount),
    },
    {
      key: "interestRate",
      header: "Rate",
      render: (row) => `${row.interestRate}%`,
    },
    {
      key: "monthlyPayment",
      header: "Monthly Return",
      render: (row) => formatCurrency(row.monthlyPayment),
    },
    {
      key: "annualInterest",
      header: "Annual Return",
      render: (row) => formatCurrency(row.annualInterest),
    },
    {
      key: "interestEarned",
      header: "Interest Earned",
      render: (row) => formatCurrency(row.interestEarned),
    },
    {
      key: "paidToDate",
      header: "Total Received",
      render: (row) => formatCurrency(row.paidToDate),
    },
    {
      key: "inceptionDate",
      header: "Inception",
      render: (row) => formatCalendarDay(row.inceptionDate),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Investment Statements"
        description="Summary of your investment returns and performance"
      />

      {/* KPI Cards */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
      >
        <KpiCard
          label="Total Invested"
          value={formatCurrency(totals.totalInvested)}
          subtitle="Principal amount"
          icon={DollarSign}
        />
        <KpiCard
          label="Total Returns"
          value={formatCurrency(totals.paidToDate)}
          subtitle="Payments received"
          icon={TrendingUp}
        />
        <KpiCard
          label="Weighted Avg Rate"
          value={`${totals.avgInterestRate}%`}
          subtitle="Across all investments"
          icon={Percent}
        />
        <KpiCard
          label="Est. Annual Income"
          value={formatCurrency(totals.annualInterest)}
          subtitle="Projected yearly returns"
          icon={Wallet}
        />
      </motion.div>

      {/* Investments Breakdown */}
      <div>
        <h3 className="mb-4 text-lg font-semibold">Investment Breakdown</h3>
        {rows.length > 0 ? (
          <DataTable data={rows} columns={columns} />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card py-16">
            <DollarSign className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No investments yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
