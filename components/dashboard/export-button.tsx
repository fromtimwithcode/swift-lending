"use client";

import { Download } from "lucide-react";
import { useState, useRef, useEffect, useId } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { exportToCsv, exportToExcel, exportToPdf } from "@/lib/export";

interface ExportColumn {
  header: string;
  key: string;
}

interface ExportButtonProps {
  data: Record<string, unknown>[];
  columns: ExportColumn[];
  filename: string;
  title?: string;
}

export function ExportButton({
  data,
  columns,
  filename,
  title,
}: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleExport = async (format: "csv" | "excel" | "pdf") => {
    setOpen(false);
    setExporting(true);
    try {
      if (format === "csv") {
        exportToCsv(filename, columns, data);
      } else if (format === "excel") {
        await exportToExcel(filename, columns, data);
      } else {
        await exportToPdf(filename, columns, data, title);
      }
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={exporting}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium transition-[background-color,box-shadow,scale] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.96] disabled:opacity-50 disabled:active:scale-100"
      >
        <Download className="size-4" />
        Export
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={menuId}
            role="menu"
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-2xl border border-border/60 bg-card p-1 shadow-[0_4px_24px_oklch(0_0_0_/_8%),0_1px_4px_oklch(0_0_0_/_4%)]"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => handleExport("csv")}
              className="min-h-10 w-full rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              Export CSV
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => handleExport("excel")}
              className="min-h-10 w-full rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              Export Excel
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => handleExport("pdf")}
              className="min-h-10 w-full rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              Export PDF
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
