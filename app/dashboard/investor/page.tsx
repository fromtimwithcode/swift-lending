"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Loader2, TrendingUp, DollarSign, Percent, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/format";

export default function InvestorDashboardPage() {
  const stats = useQuery(api.investor.getPortfolioStats);
  const investments = useQuery(api.investor.getMyInvestments);

  if (stats === undefined || investments === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const kpis = [
    {
      label: "Total Invested",
      value: formatCurrency(stats.totalInvested),
      icon: DollarSign,
    },
    {
      label: "Payments Received",
      value: formatCurrency(stats.totalPaymentsReceived),
      icon: TrendingUp,
    },
    {
      label: "Avg Interest Rate",
      value: stats.avgInterestRate.toFixed(2) + "%",
      icon: Percent,
    },
    {
      label: "Next Payment",
      value: stats.nextPaymentDate
        ? new Date(stats.nextPaymentDate).toLocaleDateString()
        : "None",
      icon: Calendar,
    },
  ];

  const columns: Column<(typeof investments)[number]>[] = [
    {
      key: "investmentAmount",
      header: "Amount",
      sortable: true,
      render: (row) => formatCurrency(row.investmentAmount),
    },
    {
      key: "inceptionDate",
      header: "Inception",
      sortable: true,
      render: (row) => new Date(row.inceptionDate).toLocaleDateString(),
    },
    {
      key: "interestRate",
      header: "Rate",
      sortable: true,
      render: (row) => row.interestRate + "%",
    },
    {
      key: "totalPaymentsReceived",
      header: "Payments Received",
      sortable: true,
      render: (row) => formatCurrency(row.totalPaymentsReceived),
      className: "hidden md:table-cell",
    },
    {
      key: "nextPaymentDate",
      header: "Next Payment",
      render: (row) => new Date(row.nextPaymentDate).toLocaleDateString(),
      className: "hidden lg:table-cell",
    },
    {
      key: "notes",
      header: "Notes",
      render: (row) => (
        <span className="max-w-[200px] truncate block">
          {row.notes || "—"}
        </span>
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

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-border bg-card p-6"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <kpi.icon className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="text-xl font-bold">{kpi.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Investments Table */}
      {investments.length > 0 ? (
        <DataTable
          data={investments as unknown as Record<string, unknown>[]}
          columns={columns as Column<Record<string, unknown>>[]}
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
