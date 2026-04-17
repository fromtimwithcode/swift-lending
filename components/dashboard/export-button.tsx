"use client";

import { Download } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
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
        onClick={() => setOpen(!open)}
        disabled={exporting}
        className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
      >
        <Download className="size-4" />
        Export
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute right-0 top-full z-50 mt-1 w-40 rounded-xl border border-border/60 bg-card py-1 shadow-[0_4px_24px_oklch(0_0_0_/_8%),0_1px_4px_oklch(0_0_0_/_4%)]"
          >
            <button
              onClick={() => handleExport("csv")}
              className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
            >
              Export CSV
            </button>
            <button
              onClick={() => handleExport("excel")}
              className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
            >
              Export Excel
            </button>
            <button
              onClick={() => handleExport("pdf")}
              className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
            >
              Export PDF
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
