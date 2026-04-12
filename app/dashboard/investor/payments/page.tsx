"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Loader2, Banknote } from "lucide-react";
import { formatCurrency } from "@/lib/format";

export default function InvestorPaymentsPage() {
  const investments = useQuery(api.investor.getMyInvestments);

  if (investments === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const columns: Column<(typeof investments)[number]>[] = [
    {
      key: "investmentAmount",
      header: "Investment",
      sortable: true,
      render: (row) => formatCurrency(row.investmentAmount),
    },
    {
      key: "interestRate",
      header: "Rate",
      sortable: true,
      render: (row) => row.interestRate + "%",
    },
    {
      key: "totalPaymentsReceived",
      header: "Total Received",
      sortable: true,
      render: (row) => formatCurrency(row.totalPaymentsReceived),
    },
    {
      key: "nextPaymentDate",
      header: "Next Payment",
      sortable: true,
      render: (row) => new Date(row.nextPaymentDate).toLocaleDateString(),
    },
    {
      key: "notes",
      header: "Notes",
      render: (row) => (
        <span className="max-w-[200px] truncate block">
          {row.notes || "—"}
        </span>
      ),
      className: "hidden md:table-cell",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Track your investment payments and schedules"
      />

      {investments.length > 0 ? (
        <DataTable
          data={investments as unknown as Record<string, unknown>[]}
          columns={columns as Column<Record<string, unknown>>[]}
        />
      ) : (
        <EmptyState
          icon={Banknote}
          title="No payments yet"
          description="Payment details will appear here once you have active investments."
        />
      )}
    </div>
  );
}
