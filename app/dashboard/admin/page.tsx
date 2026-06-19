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
import dynamic from "next/dynamic";
import {
  Landmark,
  DollarSign,
  TrendingUp,
  Wallet,
  BarChart3,
  Hammer,
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
import { useEffect, useState } from "react";

const LoanOverviewCharts = dynamic(
  () => import("@/components/dashboard/admin-overview-charts").then((mod) => mod.LoanOverviewCharts),
  { ssr: false, loading: () => <ChartGridSkeleton /> }
);

const RevenueByMonthChart = dynamic(
  () => import("@/components/dashboard/admin-overview-charts").then((mod) => mod.RevenueByMonthChart),
  { ssr: false, loading: () => <ChartCardSkeleton /> }
);

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

function ChartCardSkeleton() {
  return (
    <div className="card-premium p-6" aria-label="Loading chart">
      <div className="mb-4 h-4 w-36 animate-pulse rounded bg-muted" />
      <div className="h-[250px] animate-pulse rounded-xl bg-muted/60" />
    </div>
  );
}

function ChartGridSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCardSkeleton />
      <ChartCardSkeleton />
    </div>
  );
}

type DrilldownRequest =
  | { kind: "month"; value: string; title: string }
  | { kind: "status"; value: string; title: string };

export default function AdminOverviewPage() {
  const stats = useQuery(api.admin.getOverviewStats);
  const paymentReminders = useQuery(api.loanPayments.getAdminPaymentReminders);
  const [loadSecondaryAnalytics, setLoadSecondaryAnalytics] = useState(false);
  const paymentsSummary = useQuery(
    api.loanPayments.getAllPaymentsSummary,
    loadSecondaryAnalytics ? {} : "skip"
  );
  const borrowerPerformance = useQuery(
    api.admin.getBorrowerPerformance,
    loadSecondaryAnalytics ? {} : "skip"
  );
  const [selectedKpiYear, setSelectedKpiYear] = useState<number | null>(null);
  const loanPeriodKpis = useQuery(
    api.admin.getLoanPeriodKpis,
    loadSecondaryAnalytics
      ? selectedKpiYear
        ? { year: selectedKpiYear }
        : {}
      : "skip"
  );
  const router = useRouter();
  const [drilldownRequest, setDrilldownRequest] = useState<DrilldownRequest | null>(null);
  const drilldownLoans = useQuery(
    api.admin.getLoans,
    drilldownRequest ? {} : "skip"
  );

  useEffect(() => {
    if (stats === undefined || loadSecondaryAnalytics) return;

    const timer = window.setTimeout(() => setLoadSecondaryAnalytics(true), 1);
    return () => window.clearTimeout(timer);
  }, [stats, loadSecondaryAnalytics]);

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
    setDrilldownRequest({
      kind: "month",
      value: month,
      title: `Loans Closed in ${month}`,
    });
  };

  const openStatusDrilldown = (status: string) => {
    setDrilldownRequest({
      kind: "status",
      value: status,
      title: `${STATUS_LABELS[status] ?? status} Loans`,
    });
  };

  const drilldownMatches = drilldownRequest && drilldownLoans
    ? drilldownLoans.filter((loan) => {
        if (drilldownRequest.kind === "month") {
          return getLoanMonth(loan.closeDate) === drilldownRequest.value;
        }
        if (drilldownRequest.value === "funds_returned") return isFundsReturnedLoan(loan);
        if (drilldownRequest.value === "closed") return loan.status === "closed" && !loan.returnedDate;
        return loan.status === drilldownRequest.value && !loan.returnedDate;
      })
    : [];

  const drilldownDescription = drilldownRequest
    ? drilldownLoans === undefined
      ? "Loading matching loans..."
      : drilldownRequest.kind === "month"
        ? `${drilldownMatches.length} loan${drilldownMatches.length === 1 ? "" : "s"} with a close date in this month`
        : `${drilldownMatches.length} loan${drilldownMatches.length === 1 ? "" : "s"} currently marked ${STATUS_LABELS[drilldownRequest.value] ?? drilldownRequest.value}`
    : "";

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
        className="grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3"
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
          label="Draws Remaining"
          value={formatCurrencyShort(stats.totalDrawRemaining)}
          subtitle="Available on active loans"
          icon={Hammer}
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

          <div className="max-w-full overflow-x-auto overscroll-x-contain touch-pan-x">
            <table className="w-full min-w-[640px] text-sm">
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
        <LoanOverviewCharts
          barData={barData}
          pieData={pieData}
          onMonthClick={openMonthDrilldown}
          onStatusClick={openStatusDrilldown}
        />
      )}

      {/* Revenue & Borrower Performance */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue by Month */}
        {paymentsSummary && paymentsSummary.monthlyRevenue.length > 0 && (
          <RevenueByMonthChart data={paymentsSummary.monthlyRevenue} />
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
              <div className="grid grid-cols-1 gap-2 text-center min-[420px]:grid-cols-3 sm:min-w-72">
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
            <div className="max-w-full overflow-x-auto overscroll-x-contain touch-pan-x">
              <table className="w-full min-w-[700px] text-sm">
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

      {drilldownRequest && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="chart-drilldown-title"
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDrilldownRequest(null);
          }}
        >
          <div className="flex max-h-[88dvh] w-full max-w-5xl min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
            <div className="flex min-w-0 items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <h2 id="chart-drilldown-title" className="break-words text-lg font-semibold [overflow-wrap:anywhere]">
                  {drilldownRequest.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {drilldownDescription}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrilldownRequest(null)}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                aria-label="Close loan list"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 overflow-auto p-4 sm:p-5">
              {drilldownLoans === undefined ? (
                <PageSkeleton />
              ) : drilldownMatches.length > 0 ? (
                <DataTable
                  data={drilldownMatches as unknown as Record<string, unknown>[]}
                  columns={columns as Column<Record<string, unknown>>[]}
                  onRowClick={(row) => {
                    setDrilldownRequest(null);
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
