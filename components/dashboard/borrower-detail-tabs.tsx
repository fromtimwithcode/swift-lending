"use client";

import { Tabs } from "@base-ui/react/tabs";
import { Landmark, LayoutDashboard, UsersRound } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

const tabValues = ["overview", "financial", "parties"] as const;
type TabValue = (typeof tabValues)[number];

const tabs: { value: TabValue; label: string; icon: typeof LayoutDashboard }[] = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "financial", label: "Financial", icon: Landmark },
  { value: "parties", label: "Related parties", icon: UsersRound },
];

interface BorrowerDetailTabsProps {
  overview: ReactNode;
  financial: ReactNode;
  parties: ReactNode;
  onTabChange?: (value: TabValue) => void;
}

export function BorrowerDetailTabs({
  overview,
  financial,
  parties,
  onTabChange,
}: BorrowerDetailTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab: TabValue = tabValues.includes(requestedTab as TabValue)
    ? (requestedTab as TabValue)
    : "overview";

  const handleTabChange = (value: Tabs.Tab.Value) => {
    const nextTab = value as TabValue;
    if (nextTab !== activeTab) onTabChange?.(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === "overview") params.delete("tab");
    else params.set("tab", nextTab);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <Tabs.Root value={activeTab} onValueChange={handleTabChange}>
      <div className="overflow-x-auto overscroll-x-contain pb-1 touch-pan-x">
        <Tabs.List
          activateOnFocus
          aria-label="Borrower details"
          className="flex min-w-max items-center gap-1 rounded-2xl bg-muted/70 p-1 shadow-[inset_0_0_0_1px_var(--border)]"
        >
          {tabs.map(({ value, label, icon: Icon }) => (
            <Tabs.Tab
              key={value}
              value={value}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-semibold text-muted-foreground transition-[background-color,box-shadow,color,scale] duration-200 ease-out hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-active:bg-card data-active:text-foreground data-active:shadow-sm active:scale-[0.96]"
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </div>

      <Tabs.Panel value="overview" className="mt-6 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {overview}
      </Tabs.Panel>
      <Tabs.Panel value="financial" className="mt-6 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {financial}
      </Tabs.Panel>
      <Tabs.Panel value="parties" className="mt-6 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {parties}
      </Tabs.Panel>
    </Tabs.Root>
  );
}
