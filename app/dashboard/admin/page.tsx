"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageSkeleton } from "@/components/dashboard/skeleton";
import { PaymentRemindersCard } from "@/components/dashboard/payment-reminders-card";
import {
  Landmark,
  DollarSign,
  TrendingUp,
  Wallet,
  BarChart3,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatCurrencyShort } from "@/lib/format";
import { motion } from "framer-motion";
import { staggerContainer } from "@/lib/animations";
import {
  getLoanDisplayStatus,
  getLoanStatusLabel,
  isActiveLoanDisplay,
  isFundsReturnedLoan,
} from "@/lib/loan-display";
import { useState } from "react";
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

const STATUS_COLORS: Record<string, string> = {
  submitted: "#9ca3af",
  under_review: "#3b82f6",
  additional_info_needed: "#f59e0b",
  approved: "#22c55e",
  denied: "#ef4444",
  funded: "#a855f7",
  sent_to_title: "#6366f1",
  closed: "#10b981",
  funds_returned: "#14b8a6",
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
  funds_returned: "Funds Returned",
};

export default function AdminOverviewPage() {
  const stats = useQuery(api.admin.getOverviewStats);
  const allLoans = useQuery(api.admin.getLoans, {});
  const paymentsSummary = useQuery(api.loanPayments.getAllPaymentsSummary);
  const paymentReminders = useQuery(api.loanPayments.getAdminPaymentReminders);
  const borrowerPerformance = useQuery(api.admin.getBorrowerPerformance);
  const [selectedKpiYear, setSelectedKpiYear] = useState<number | null>(null);
  const loanPeriodKpis = useQuery(
    api.admin.getLoanPeriodKpis,
    selectedKpiYear ? { year: selectedKpiYear } : {}
  );
  const router = useRouter();
  const [drilldown, setDrilldown] = useState<{
    title: string;
    description: string;
    loans: NonNullable<typeof allLoans>;
  } | null>(null);

  if (stats === undefined) {
    return <PageSkeleton />;
  }

  // Use pre-computed chart data from getOverviewStats (no duplicate getLoans call)
  const pieData = Object.entries(stats.statusCounts).map(([status, count]) => ({
    status,
    name: STATUS_LABELS[status] ?? status,
    value: count,
    fill: STATUS_COLORS[status] ?? "#9ca3af",
  }));

  const barData = Object.entries(stats.monthlyVolume)
    .sort((a, b) => {
      const [am, ay] = a[0].split("/").map(Number);
      const [bm, by_] = b[0].split("/").map(Number);
      return (ay * 100 + am) - (by_ * 100 + bm);
    })
    .slice(-6)
    .map(([month, count]) => ({
      month,
      loans: count,
    }));

  const recentLoans = stats.recentLoans;
  const borrowerClosedLoans = borrowerPerformance?.reduce((sum, borrower) => sum + borrower.totalLoans, 0) ?? 0;
  const borrowerInProgressLoans = borrowerPerformance?.reduce((sum, borrower) => sum + borrower.inProgressLoans, 0) ?? 0;
  const borrowerClosedCapital = borrowerPerformance?.reduce((sum, borrower) => sum + borrower.totalCapital, 0) ?? 0;
  const kpiYears = loanPeriodKpis
    ? loanPeriodKpis.availableYears.length > 0
      ? loanPeriodKpis.availableYears
      : [loanPeriodKpis.selectedYear]
    : [];

  const getLoanMonth = (closeDate: string | undefined) => {
    if (!closeDate) return null;
    const parts = closeDate.split("/");
    if (parts.length < 3) return null;
    return `${parts[0]}/${parts[2]}`;
  };

  const openMonthDrilldown = (month: string) => {
    const loans = (allLoans ?? []).filter((loan) => getLoanMonth(loan.closeDate) === month);
    setDrilldown({
      title: `Loans Closed in ${month}`,
      description: `${loans.length} loan${loans.length === 1 ? "" : "s"} with a close date in this month`,
      loans,
    });
  };

  const openStatusDrilldown = (status: string) => {
    const loans = (allLoans ?? []).filter((loan) => {
      if (status === "funds_returned") return isFundsReturnedLoan(loan);
      if (status === "closed") return loan.status === "closed" && !loan.returnedDate;
      return loan.status === status && !loan.returnedDate;
    });
    setDrilldown({
      title: `${STATUS_LABELS[status] ?? status} Loans`,
      description: `${loans.length} loan${loans.length === 1 ? "" : "s"} currently marked ${STATUS_LABELS[status] ?? status}`,
      loans,
    });
  };

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
      render: (row) => formatCurrencyShort(row.loanAmount),
    },
    {
      key: "rehabBudgetTotal",
      header: "Rehab",
      sortable: true,
      render: (row) => row.rehabBudgetTotal ? formatCurrency(row.rehabBudgetTotal) : "—",
      className: "hidden lg:table-cell",
    },
    {
      key: "drawFundsTotal",
      header: "Draw Remaining",
      sortable: true,
      render: (row) => row.drawFundsTotal !== undefined
        ? formatCurrency(Math.max(0, row.drawFundsTotal - (row.drawFundsUsed ?? 0)))
        : "—",
      className: "hidden xl:table-cell",
    },
    {
      key: "monthlyPayment",
      header: "Monthly Payment",
      sortable: true,
      render: (row) => formatCurrency(row.monthlyPayment),
    },
    {
      key: "status",
      header: "Loan State",
      sortable: true,
      render: (row) => (
        <div className="space-y-1">
          <StatusBadge status={getLoanDisplayStatus(row)} />
          {isActiveLoanDisplay(row) && (
            <p className="text-xs text-muted-foreground">{getLoanStatusLabel(row.status)}</p>
          )}
          {isFundsReturnedLoan(row) && row.returnedDate && (
            <p className="text-xs text-muted-foreground tabular-nums">Returned {row.returnedDate}</p>
          )}
        </div>
      ),
    },
    {
      key: "closeDate",
      header: "Close / Return",
      sortable: true,
      render: (row) => (
        <div className="space-y-1 tabular-nums">
          <p>{row.closeDate ?? "\u2014"}</p>
          {row.returnedDate && (
            <p className="text-xs font-medium text-teal-700 dark:text-teal-300">
              Returned {row.returnedDate}
            </p>
          )}
          {row.returnedAmount !== undefined && (
            <p className="text-xs text-muted-foreground">{formatCurrency(row.returnedAmount)}</p>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="Key metrics and recent activity"
      />

      {/* KPI Cards */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5"
      >
        <KpiCard
          label="Total Loans"
          value={stats.totalLoans}
          subtitle={`${stats.activePipeline} active / ${stats.closedLoans} closed / ${stats.returnedLoans} returned`}
          icon={Landmark}
        />
        <KpiCard
          label="Capital Out"
          value={formatCurrencyShort(stats.capitalCurrentlyOut)}
          subtitle="Current principal outstanding"
          icon={DollarSign}
        />
        <KpiCard
          label="Closed Loan Revenue"
          value={formatCurrencyShort(stats.closedLoanRevenue)}
          subtitle="Points + interest (closed)"
          icon={TrendingUp}
        />
        <KpiCard
          label="Monthly Cash Flow"
          value={formatCurrency(stats.monthlyCashFlow)}
          subtitle={`${stats.cashFlowInterestRate}% IO on ${formatCurrencyShort(stats.totalPrincipalOut)} out`}
          icon={Wallet}
        />
        <KpiCard
          label="Pipeline Value"
          value={formatCurrencyShort(stats.pipelineValue)}
          subtitle="Non-closed loans"
          icon={BarChart3}
        />
      </motion.div>

      {loanPeriodKpis && (
        <div className="card-premium p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                Loan KPIs by Period
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Grouped by loan close date for quarter and full-year reporting.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Year
              <select
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
                value={loanPeriodKpis.selectedYear}
                onChange={(event) => setSelectedKpiYear(Number(event.target.value))}
              >
                {kpiYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-3">Period</th>
                  <th className="pb-2 pr-3">Total Loans</th>
                  <th className="pb-2 pr-3">Active</th>
                  <th className="pb-2 pr-3">In Progress</th>
                  <th className="pb-2 pr-3">Funded</th>
                  <th className="pb-2 pr-3">Returned</th>
                  <th className="pb-2">Capital</th>
                </tr>
              </thead>
              <tbody>
                {loanPeriodKpis.periods.map((period) => (
                  <tr key={period.key} className="border-b border-border/50 last:border-0">
                    <td className="py-3 pr-3 font-medium">{period.label}</td>
                    <td className="py-3 pr-3 tabular-nums">{period.totalLoans}</td>
                    <td className="py-3 pr-3 tabular-nums">{period.activeLoans}</td>
                    <td className="py-3 pr-3 tabular-nums">{period.inProgressLoans}</td>
                    <td className="py-3 pr-3 tabular-nums">{period.fundedLoans}</td>
                    <td className="py-3 pr-3 tabular-nums">{period.returnedLoans}</td>
                    <td className="py-3 tabular-nums">{formatCurrencyShort(period.totalCapital)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PaymentRemindersCard
        data={paymentReminders}
        description="All active loans with past due payments or payments coming up soon."
        onLoanClick={(loanId) => router.push(`/dashboard/admin/loans/${loanId}`)}
      />

      {/* Charts */}
      {stats.totalLoans > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Loan Volume by Month */}
          {barData.length > 0 && (
            <div className="card-premium p-6">
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
                      borderRadius: "12px",
                    }}
                  />
                  <Bar
                    dataKey="loans"
                    fill="var(--primary)"
                    radius={[4, 4, 0, 0]}
                    className="cursor-pointer"
                    onClick={(entry) =>
                      openMonthDrilldown((entry.payload as { month: string }).month)
                    }
                  />
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-3 text-xs text-muted-foreground">
                Click a bar to view the loans for that month.
              </p>
            </div>
          )}

          {/* Status Distribution */}
          {pieData.length > 0 && (
            <div className="card-premium p-6">
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
                    className="cursor-pointer"
                    onClick={(entry) =>
                      openStatusDrilldown((entry.payload as { status: string }).status)
                    }
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} className="focus:outline-none" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 flex flex-wrap gap-3">
                {pieData.map((entry, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => openStatusDrilldown(entry.status)}
                    className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <div
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: entry.fill }}
                    />
                    {entry.name} ({entry.value})
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Click a slice or status label to view the matching loans.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Revenue & Borrower Performance */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue by Month */}
        {paymentsSummary && paymentsSummary.monthlyRevenue.length > 0 && (
          <div className="card-premium p-6">
            <h3 className="mb-4 text-sm font-medium text-muted-foreground">
              Revenue by Month
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={paymentsSummary.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
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
          <div className="card-premium p-6">
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Borrower Performance
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Performance is based on closed loans only.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center sm:min-w-72">
                <div className="rounded-xl bg-muted/50 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">Closed</p>
                  <p className="text-sm font-semibold">{borrowerClosedLoans}</p>
                </div>
                <div className="rounded-xl bg-muted/50 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">In Progress</p>
                  <p className="text-sm font-semibold">{borrowerInProgressLoans}</p>
                </div>
                <div className="rounded-xl bg-muted/50 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">Closed Capital</p>
                  <p className="text-sm font-semibold">{formatCurrencyShort(borrowerClosedCapital)}</p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3">Name</th>
                    <th className="pb-2 pr-3">Closed</th>
                    <th className="pb-2 pr-3">In Progress</th>
                    <th className="pb-2 pr-3">Closed Capital</th>
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
                      <td className="py-2 pr-3">{b.inProgressLoans}</td>
                      <td className="py-2 pr-3">{formatCurrencyShort(b.totalCapital)}</td>
                      <td className="py-2 pr-3">{b.totalPayments}</td>
                      <td className="py-2 pr-3 text-amber-600">{b.latePayments}</td>
                      <td className="py-2">
                        {b.onTimeRate !== null ? (
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
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
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

      {drilldown && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="chart-drilldown-title"
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDrilldown(null);
          }}
        >
          <div className="flex max-h-[88dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 id="chart-drilldown-title" className="text-lg font-semibold">
                  {drilldown.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {drilldown.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrilldown(null)}
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Close loan list"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 overflow-auto p-5">
              {drilldown.loans.length > 0 ? (
                <DataTable
                  data={drilldown.loans as unknown as Record<string, unknown>[]}
                  columns={columns as Column<Record<string, unknown>>[]}
                  onRowClick={(row) => {
                    setDrilldown(null);
                    router.push(`/dashboard/admin/loans/${(row as unknown as { _id: string })._id}`);
                  }}
                />
              ) : (
                <EmptyState
                  icon={Landmark}
                  title="No matching loans"
                  description="There are no loans in this chart segment."
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
