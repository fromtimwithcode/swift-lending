"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface LoanVolumeDatum {
  month: string;
  loans: number;
}

interface StatusDatum {
  status: string;
  name: string;
  value: number;
  fill: string;
}

interface RevenueDatum {
  month: string;
  amount: number;
}

interface LoanOverviewChartsProps {
  barData: LoanVolumeDatum[];
  pieData: StatusDatum[];
  onMonthClick: (month: string) => void;
  onStatusClick: (status: string) => void;
}

export function LoanOverviewCharts({
  barData,
  pieData,
  onMonthClick,
  onStatusClick,
}: LoanOverviewChartsProps) {
  if (barData.length === 0 && pieData.length === 0) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
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
                  onMonthClick((entry.payload as { month: string }).month)
                }
              />
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-3 text-xs text-muted-foreground">
            Click a bar to view the loans for that month.
          </p>
        </div>
      )}

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
                  onStatusClick((entry.payload as { status: string }).status)
                }
              >
                {pieData.map((entry) => (
                  <Cell key={entry.status} fill={entry.fill} className="focus:outline-none" />
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
            {pieData.map((entry) => (
              <button
                key={entry.status}
                type="button"
                onClick={() => onStatusClick(entry.status)}
                className="flex min-h-8 items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <span
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
  );
}

export function RevenueByMonthChart({ data }: { data: RevenueDatum[] }) {
  if (data.length === 0) return null;

  return (
    <div className="card-premium p-6">
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">
        Revenue by Month
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="month" className="text-xs" />
          <YAxis
            className="text-xs"
            tickFormatter={(value) =>
              value >= 1000 ? `$${(value / 1000).toFixed(0)}K` : `$${value}`
            }
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
            }}
            formatter={(value) => [`$${Number(value).toLocaleString()}`, "Revenue"]}
          />
          <Bar dataKey="amount" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
