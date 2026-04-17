"use client";

import { motion } from "framer-motion";

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
    <div className="flex items-center gap-8 border-b border-border/50 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          aria-current={activeTab === tab.value ? "true" : undefined}
          className={`relative shrink-0 pb-3 text-sm font-medium transition-colors ${
            activeTab === tab.value
              ? "text-foreground"
              : "text-muted-foreground/70 hover:text-foreground"
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 text-xs text-muted-foreground/50">
              {tab.count}
            </span>
          )}
          {activeTab === tab.value && (
            <motion.span
              layoutId="tab-indicator"
              className="absolute inset-x-0 bottom-0 h-0.5 bg-primary"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
