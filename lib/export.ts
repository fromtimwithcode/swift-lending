interface ExportColumn {
  header: string;
  key: string;
}

function getValue(row: Record<string, unknown>, key: string): string {
  const val = row[key];
  if (val == null) return "";
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "number") return String(val);
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function escapeCsvField(field: string): string {
  // Prevent CSV injection — prefix formula-triggering characters with a single quote
  const first = field.charAt(0);
  if (first === "=" || first === "+" || first === "-" || first === "@" || first === "\t" || first === "\r") {
    field = "'" + field;
  }
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToCsv(
  filename: string,
  columns: ExportColumn[],
  data: Record<string, unknown>[]
) {
  const header = columns.map((c) => escapeCsvField(c.header)).join(",");
  const rows = data.map((row) =>
    columns.map((c) => escapeCsvField(getValue(row, c.key))).join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

export async function exportToExcel(
  filename: string,
  columns: ExportColumn[],
  data: Record<string, unknown>[]
) {
  try {
    const XLSX = await import("xlsx");
    const wsData = [
      columns.map((c) => c.header),
      ...data.map((row) => columns.map((c) => getValue(row, c.key))),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
  } catch {
    alert("Excel export failed. Please try again.");
  }
}

export async function exportToPdf(
  filename: string,
  columns: ExportColumn[],
  data: Record<string, unknown>[],
  title?: string
) {
  try {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF({ orientation: "landscape" });

    if (title) {
      doc.setFontSize(16);
      doc.text(title, 14, 20);
    }

    const head = [columns.map((c) => c.header)];
    const body = data.map((row) => columns.map((c) => getValue(row, c.key)));

    autoTable(doc, {
      head,
      body,
      startY: title ? 28 : 14,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [39, 39, 42] },
    });

    doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
  } catch {
    alert("PDF export failed. Please try again.");
  }
}
