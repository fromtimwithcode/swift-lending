"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Tab {
  label: string;
  value: string;
  count?: number;
}

interface StatusTabFilterProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (value: string) => void;
}

export function StatusTabFilter({
  tabs,
  activeTab,
  onChange,
}: StatusTabFilterProps) {
  return (
    <div
      role="tablist"
      aria-label="Status filter"
      className="flex w-full min-w-0 items-center gap-1 overflow-x-auto overscroll-x-contain rounded-2xl border border-border/60 bg-card/70 p-1 shadow-[0_1px_3px_oklch(0_0_0_/_3%)] touch-pan-x"
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          onClick={() => onChange(tab.value)}
          aria-selected={activeTab === tab.value}
          className={cn(
            "relative min-h-10 shrink-0 rounded-xl px-3.5 text-sm font-semibold transition-[color,scale] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.98]",
            activeTab === tab.value
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {activeTab === tab.value && (
            <motion.span
              layoutId="tab-indicator"
              className="absolute inset-0 rounded-xl bg-background shadow-sm"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative">{tab.label}</span>
          {tab.count !== undefined && (
            <span className="relative ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground tabular-nums">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
