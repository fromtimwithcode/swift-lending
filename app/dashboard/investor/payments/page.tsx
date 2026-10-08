"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Banknote } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { PageSkeleton } from "@/components/dashboard/skeleton";
import { formatCalendarDay, getPaymentDayLabel } from "@/convex/lib/investmentSchedule";
import { getPayoutHistory, type PayoutHistoryRow } from "@/lib/investor-portfolio";
import { useBusinessToday } from "@/hooks/use-business-today";

export default function InvestorPaymentsPage() {
  const today = useBusinessToday();
  const portfolio = useQuery(api.investments.getMyPortfolio, { today });

  if (portfolio === undefined) {
    return <PageSkeleton />;
  }

  const history = getPayoutHistory(portfolio);
  const columns: Column<PayoutHistoryRow>[] = [
    {
      key: "paidDate",
      header: "Date",
      sortable: true,
      render: (row) => formatCalendarDay(row.paidDate),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      render: (row) => formatCurrency(row.amount),
    },
    { key: "investment", header: "Investment" },
    { key: "method", header: "Method", className: "hidden sm:table-cell" },
    {
      key: "reference",
      header: "Reference",
      render: (row) => row.reference || "—",
      className: "hidden md:table-cell",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Payments"
        description="Upcoming interest payments and the payments you've received"
      />

      {portfolio.investments.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="No payments yet"
          description="Payment details will appear here once you have active investments."
        />
      ) : (
        <>
          <section aria-labelledby="upcoming-heading">
            <h3 id="upcoming-heading" className="mb-4 text-lg font-semibold">
              Upcoming
            </h3>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {portfolio.investments.map((investment) => {
                const next = investment.summary.nextPayment;
                return (
                  <li key={investment._id} className="rounded-xl border border-border bg-card p-5">
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatCurrency(investment.investmentAmount)} at {investment.interestRate}%
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums">
                      {next ? formatCurrency(next.amount) : "None"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                      {next
                        ? next.dueDate === portfolio.today
                          ? "Due today"
                          : `Due ${formatCalendarDay(next.dueDate)}`
                        : "No interest is due"}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {formatCurrency(investment.summary.monthlyPayment)} paid monthly on{" "}
                      {getPaymentDayLabel(investment.firstPaymentDate)}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="history-heading">
            <h3 id="history-heading" className="mb-4 text-lg font-semibold">
              Payment history
            </h3>
            <DataTable
              data={history}
              columns={columns}
              emptyMessage="No payments recorded yet"
            />
          </section>
        </>
      )}
    </div>
  );
}
