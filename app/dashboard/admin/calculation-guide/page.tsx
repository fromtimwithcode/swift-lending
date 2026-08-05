"use client";

import { useQuery } from "convex/react";
import {
  BookOpenCheck,
  Calculator,
  ChartNoAxesCombined,
  Landmark,
  LockKeyhole,
  ReceiptText,
  Scale,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageSkeleton } from "@/components/dashboard/skeleton";

type SectionId =
  | "principal"
  | "interest"
  | "payments"
  | "payoff"
  | "reporting"
  | "comps";

const SECTION_ICONS: Record<SectionId, LucideIcon> = {
  principal: Landmark,
  interest: Calculator,
  payments: ReceiptText,
  payoff: Scale,
  reporting: ChartNoAxesCombined,
  comps: BookOpenCheck,
};

export default function CalculationGuidePage() {
  const guide = useQuery(api.calculationGuide.get);

  if (guide === undefined) return <PageSkeleton />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Calculation Guide"
        description="See how Swift Capital calculates loan balances, interest, payments, payoff estimates, dashboard totals, and comparable-property rankings."
        actions={
          <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-3 text-xs font-semibold text-muted-foreground">
            <LockKeyhole className="size-3.5" aria-hidden="true" />
            Reference only
          </span>
        }
      />

      <section
        className="card-premium overflow-hidden"
        aria-labelledby="calculation-guide-defaults-heading"
      >
        <div className="flex flex-col gap-4 border-b border-border/50 bg-primary/[0.035] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <WalletCards className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id="calculation-guide-defaults-heading"
                className="text-base font-semibold tracking-tight"
              >
                Current lending defaults
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground text-pretty">
                These are the standard values used for new loan records. A loan&apos;s saved terms take priority where noted.
              </p>
            </div>
          </div>
          <span className="shrink-0 text-xs font-medium text-primary">
            Current settings
          </span>
        </div>

        <dl className="grid sm:grid-cols-2 xl:grid-cols-4">
          {guide.defaults.map((item) => (
            <div
              key={item.label}
              className="border-border/50 p-5 [&:not(:first-child)]:border-t sm:p-6 sm:[&:nth-child(2)]:border-t-0 sm:[&:nth-child(even)]:border-l sm:[&:nth-child(n+3)]:border-t xl:[&:not(:first-child)]:border-l xl:[&:nth-child(n+3)]:border-t-0"
            >
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {item.label}
              </dt>
              <dd className="mt-2 text-2xl font-bold tracking-tight tabular-nums">
                {item.value}
              </dd>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {item.detail}
              </p>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        {guide.sections.map((section) => {
          const Icon = SECTION_ICONS[section.id];
          return (
            <section
              key={section.id}
              className="card-premium min-w-0 overflow-hidden"
              aria-labelledby={`${section.id}-heading`}
            >
              <div className="flex items-start gap-3 border-b border-border/50 p-5 sm:p-6">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2
                    id={`${section.id}-heading`}
                    className="text-base font-semibold tracking-tight"
                  >
                    {section.title}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground text-pretty">
                    {section.description}
                  </p>
                </div>
              </div>

              <dl className="divide-y divide-border/50 px-5 sm:px-6">
                {section.rules.map((rule) => (
                  <div key={rule.name} className="py-5">
                    <dt className="text-sm font-semibold text-foreground">
                      {rule.name}
                    </dt>
                    <dd className="mt-2 break-words text-sm font-medium leading-6 text-foreground tabular-nums [overflow-wrap:anywhere]">
                      {rule.formula}
                    </dd>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground text-pretty">
                      {rule.detail}
                    </p>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
      </div>
    </div>
  );
}
