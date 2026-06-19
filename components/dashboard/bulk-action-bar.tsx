"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

interface BulkAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive";
}

interface BulkActionBarProps {
  selectedCount: number;
  actions: BulkAction[];
  onClear: () => void;
  disabled?: boolean;
}

export function BulkActionBar({
  selectedCount,
  actions,
  onClear,
  disabled = false,
}: BulkActionBarProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {selectedCount > 0 && (
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ type: "spring", duration: shouldReduceMotion ? 0 : 0.3, bounce: 0 }}
          className="fixed inset-x-4 bottom-[calc(5.5rem_+_env(safe-area-inset-bottom))] z-50 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 lg:bottom-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <div className="flex max-h-[calc(100dvh_-_2rem)] max-w-full flex-col gap-3 overflow-y-auto rounded-2xl border border-border/60 bg-card/95 px-4 py-3 shadow-[0_4px_24px_oklch(0_0_0_/_10%),0_1px_4px_oklch(0_0_0_/_5%)] backdrop-blur-xl sm:flex-row sm:items-center">
            <span className="text-sm font-medium whitespace-nowrap tabular-nums">
              {selectedCount} selected
            </span>
            <div className="hidden h-5 w-px bg-border sm:block" />
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  disabled={disabled}
                  className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-[background-color,scale] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.96] disabled:opacity-50 disabled:active:scale-100 max-sm:flex-1 ${
                    action.variant === "destructive"
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-primary text-primary-foreground hover:bg-primary/80"
                  }`}
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear selected rows"
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl text-muted-foreground transition-[background-color,color,scale] duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.96]"
            >
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
