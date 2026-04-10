"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  Landmark,
  DollarSign,
  TrendingUp,
  Wallet,
  BarChart3,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

const STATUS_COLORS: Record<string, string> = {
  submitted: "#9ca3af",
  under_review: "#3b82f6",
  additional_info_needed: "#f59e0b",
  approved: "#22c55e",
  denied: "#ef4444",
  funded: "#a855f7",
  sent_to_title: "#6366f1",
  closed: "#10b981",
};

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  additional_info_needed: "Info Needed",
  approved: "Approved",
  denied: "Denied",
  funded: "Funded",
  sent_to_title: "Sent to Title",
  closed: "Closed",
};

export default function AdminOverviewPage() {
  const stats = useQuery(api.admin.getOverviewStats);
  const loans = useQuery(api.admin.getLoans, {});
  const paymentsSummary = useQuery(api.loanPayments.getAllPaymentsSummary);
  const borrowerPerformance = useQuery(api.admin.getBorrowerPerformance);
  const router = useRouter();

  if (stats === undefined || loans === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  // Status distribution for pie chart
  const statusCounts = (loans ?? []).reduce(
    (acc, loan) => {
      acc[loan.status] = (acc[loan.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const pieData = Object.entries(statusCounts).map(([status, count]) => ({
    name: STATUS_LABELS[status] ?? status,
    value: count,
    fill: STATUS_COLORS[status] ?? "#9ca3af",
  }));

  // Monthly volume (group by close month)
  const monthlyVolume = (loans ?? [])
    .filter((l) => l.closeDate)
    .reduce(
      (acc, loan) => {
        const parts = loan.closeDate!.split("/");
        const monthKey = parts.length >= 2 ? `${parts[0]}/${parts[2] ?? ""}` : loan.closeDate!;
        acc[monthKey] = (acc[monthKey] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

  const barData = Object.entries(monthlyVolume)
    .slice(-6)
    .map(([month, count]) => ({
      month,
      loans: count,
    }));

  // Recent loans for table
  const recentLoans = [...(loans ?? [])]
    .sort((a, b) => b._creationTime - a._creationTime)
    .slice(0, 10);

  const columns: Column<(typeof recentLoans)[number]>[] = [
    {
      key: "borrowerName",
      header: "Borrower",
      sortable: true,
    },
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
      key: "monthlyPayment",
      header: "Monthly Payment",
      sortable: true,
      render: (row) => formatCurrency(row.monthlyPayment),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "closeDate",
      header: "Close Date",
      sortable: true,
      render: (row) => row.closeDate ?? "—",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="Key metrics and recent activity"
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Total Loans"
          value={stats.totalLoans}
          subtitle={`${stats.openLoans} open / ${stats.closedLoans} closed`}
          icon={Landmark}
        />
        <KpiCard
          label="Total Capital"
          value={formatCurrency(stats.totalCapital)}
          subtitle="All loan amounts"
          icon={DollarSign}
        />
        <KpiCard
          label="Revenue Earned"
          value={formatCurrency(stats.revenueEarned)}
          subtitle="Points + interest"
          icon={TrendingUp}
        />
        <KpiCard
          label="Monthly Cash Flow"
          value={formatCurrency(stats.monthlyCashFlow)}
          subtitle="Active loan payments"
          icon={Wallet}
        />
        <KpiCard
          label="Pipeline Value"
          value={formatCurrency(stats.pipelineValue)}
          subtitle="Non-closed loans"
          icon={BarChart3}
        />
      </div>

      {/* Charts */}
      {loans.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Loan Volume by Month */}
          {barData.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                Loan Volume by Month
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar
                    dataKey="loans"
                    fill="var(--primary)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Status Distribution */}
          {pieData.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                Loan Status Distribution
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 flex flex-wrap gap-3">
                {pieData.map((entry, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: entry.fill }}
                    />
                    {entry.name} ({entry.value})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Revenue & Borrower Performance */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue by Month */}
        {paymentsSummary && paymentsSummary.monthlyRevenue.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="mb-4 text-sm font-medium text-muted-foreground">
              Revenue by Month
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={paymentsSummary.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                  }}
                  formatter={(value) => [`$${Number(value).toLocaleString()}`, "Revenue"]}
                />
                <Bar dataKey="amount" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Borrower Performance */}
        {borrowerPerformance && borrowerPerformance.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="mb-4 text-sm font-medium text-muted-foreground">
              Borrower Performance
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3">Name</th>
                    <th className="pb-2 pr-3">Loans</th>
                    <th className="pb-2 pr-3">Capital</th>
                    <th className="pb-2 pr-3">Payments</th>
                    <th className="pb-2 pr-3">Late</th>
                    <th className="pb-2">On-Time</th>
                  </tr>
                </thead>
                <tbody>
                  {borrowerPerformance.map((b) => (
                    <tr key={b._id} className="border-b border-border/50">
                      <td className="py-2 pr-3 font-medium">{b.displayName}</td>
                      <td className="py-2 pr-3">{b.totalLoans}</td>
                      <td className="py-2 pr-3">{formatCurrency(b.totalCapital)}</td>
                      <td className="py-2 pr-3">{b.totalPayments}</td>
                      <td className="py-2 pr-3 text-amber-600">{b.latePayments}</td>
                      <td className="py-2">
                        <span
                          className={`font-medium ${
                            b.onTimeRate >= 90
                              ? "text-green-600"
                              : b.onTimeRate >= 70
                                ? "text-amber-600"
                                : "text-red-600"
                          }`}
                        >
                          {b.onTimeRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Recent Loans Table */}
      <div>
        <h3 className="mb-4 text-lg font-semibold">Recent Loans</h3>
        {recentLoans.length > 0 ? (
          <DataTable
            data={recentLoans as unknown as Record<string, unknown>[]}
            columns={columns as Column<Record<string, unknown>>[]}
            onRowClick={(row) =>
              router.push(
                `/dashboard/admin/loans/${(row as unknown as { _id: string })._id}`
              )
            }
          />
        ) : (
          <EmptyState
            icon={Landmark}
            title="No loans yet"
            description="Create your first loan to see metrics and data here."
            action={
              <button
                onClick={() => router.push("/dashboard/admin/loans/new")}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
              >
                Add First Loan
              </button>
            }
          />
        )}
      </div>
    </div>
  );
}
