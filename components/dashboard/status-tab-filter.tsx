"use client";

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
    <div className="flex items-center gap-6 border-b border-border overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          aria-current={activeTab === tab.value ? "true" : undefined}
          className={`relative shrink-0 pb-3 text-sm font-medium transition-colors ${
            activeTab === tab.value
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 text-xs text-muted-foreground">
              {tab.count}
            </span>
          )}
          {activeTab === tab.value && (
            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
          )}
        </button>
      ))}
    </div>
  );
}
