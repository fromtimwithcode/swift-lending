"use client";

import { Download } from "lucide-react";
import { useState, useRef, useEffect } from "react";
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
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={exporting}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
      >
        <Download className="size-4" />
        Export
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border border-border bg-card py-1 shadow-lg">
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
        </div>
      )}
    </div>
  );
}
