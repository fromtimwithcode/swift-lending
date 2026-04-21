"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

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
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/95 px-4 py-3 shadow-[0_4px_24px_oklch(0_0_0_/_10%),0_1px_4px_oklch(0_0_0_/_5%)] backdrop-blur-xl">
            <span className="text-sm font-medium whitespace-nowrap">
              {selectedCount} selected
            </span>
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-2">
              {actions.map((action) => (
                <button
                  key={action.label}
                  onClick={action.onClick}
                  disabled={disabled}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
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
              onClick={onClear}
              className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
