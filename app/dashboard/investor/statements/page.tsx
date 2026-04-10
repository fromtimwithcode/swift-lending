"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { DollarSign, TrendingUp, Percent, Wallet, Loader2 } from "lucide-react";

function formatCurrency(value: number): string {
  if (value === 0) return "$0";
  return "$" + value.toLocaleString();
}

export default function InvestorStatementsPage() {
  const statement = useQuery(api.investor.getInvestmentStatement);

  if (statement === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "investmentAmount",
      header: "Amount",
      render: (row) => formatCurrency(row.investmentAmount as number),
    },
    {
      key: "interestRate",
      header: "Rate",
      render: (row) => `${row.interestRate}%`,
    },
    {
      key: "monthlyReturn",
      header: "Monthly Return",
      render: (row) => formatCurrency(row.monthlyReturn as number),
    },
    {
      key: "annualReturn",
      header: "Annual Return",
      render: (row) => formatCurrency(row.annualReturn as number),
    },
    {
      key: "totalPaymentsReceived",
      header: "Total Received",
      render: (row) => formatCurrency(row.totalPaymentsReceived as number),
    },
    {
      key: "inceptionDate",
      header: "Inception",
      render: (row) => new Date(row.inceptionDate as number).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Investment Statements"
        description="Summary of your investment returns and performance"
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Invested"
          value={formatCurrency(statement.totalInvested)}
          subtitle="Principal amount"
          icon={DollarSign}
        />
        <KpiCard
          label="Total Returns"
          value={formatCurrency(statement.totalReturns)}
          subtitle="Payments received"
          icon={TrendingUp}
        />
        <KpiCard
          label="Weighted Avg Rate"
          value={`${statement.weightedAvgRate}%`}
          subtitle="Across all investments"
          icon={Percent}
        />
        <KpiCard
          label="Est. Annual Income"
          value={formatCurrency(statement.estAnnualIncome)}
          subtitle="Projected yearly returns"
          icon={Wallet}
        />
      </div>

      {/* Investments Breakdown */}
      <div>
        <h3 className="mb-4 text-lg font-semibold">Investment Breakdown</h3>
        {statement.breakdown.length > 0 ? (
          <DataTable
            data={statement.breakdown as unknown as Record<string, unknown>[]}
            columns={columns}
          />
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
