import type { jsPDF } from "jspdf";
import type { PayoffStatement } from "@/hooks/use-payoff-statement";

const COMPANY_NAME = "SWIFT CAPITAL LENDING LLC";

function formatMoney(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatLongDate(value: string) {
  const [month, day, year] = value.split("/").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function drawLabeledText(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  rightEdge: number
) {
  doc.setFont("helvetica", "bold");
  doc.text(`${label}:`, x, y);
  const valueX = x + doc.getTextWidth(`${label}: `);
  doc.setFont("helvetica", "normal");
  const valueLines = doc.splitTextToSize(value, rightEdge - valueX);
  doc.text(valueLines, valueX, y, { lineHeightFactor: 1.25 });
  return y + Math.max(20, valueLines.length * 14);
}

export async function createPayoffStatementPdf(statement: PayoffStatement) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const tableWidth = pageWidth - margin * 2;
  const descriptionWidth = tableWidth * 0.72;
  const amountX = margin + descriptionWidth;

  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.text(COMPANY_NAME, pageWidth / 2, 64, { align: "center" });
  doc.setFontSize(16);
  doc.text("PAYOFF STATEMENT", pageWidth / 2, 98, { align: "center" });

  doc.setFontSize(11);
  let detailY = drawLabeledText(
    doc,
    "Date Issued",
    formatLongDate(statement.issuedDate),
    margin,
    146,
    pageWidth - margin
  );
  detailY = drawLabeledText(
    doc,
    "Borrower",
    statement.borrowerName,
    margin,
    detailY,
    pageWidth - margin
  );
  detailY = drawLabeledText(
    doc,
    "Property Address",
    statement.propertyAddress,
    margin,
    detailY,
    pageWidth - margin
  );

  const tableTop = detailY + 8;
  const rowHeight = 27;
  doc.setFillColor(31, 78, 121);
  doc.rect(margin, tableTop, tableWidth, rowHeight, "F");
  doc.setDrawColor(170, 170, 170);
  doc.rect(margin, tableTop, tableWidth, rowHeight * 4);
  doc.line(amountX, tableTop, amountX, tableTop + rowHeight * 4);
  for (let row = 1; row < 4; row += 1) {
    doc.line(
      margin,
      tableTop + rowHeight * row,
      margin + tableWidth,
      tableTop + rowHeight * row
    );
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("Description", margin + 8, tableTop + 18);
  doc.text("Amount", amountX + 8, tableTop + 18);

  const rows = [
    ["Total Payoff Amount", formatMoney(statement.totalPayoff)],
    ["Per Diem Interest", `${formatMoney(statement.perDiemInterest)}/day`],
    ["Good Through", formatLongDate(statement.goodThroughDate)],
  ];
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "normal");
  rows.forEach(([label, value], index) => {
    const baseline = tableTop + rowHeight * (index + 1) + 18;
    doc.text(label, margin + 8, baseline);
    doc.text(value, margin + tableWidth - 8, baseline, { align: "right" });
  });

  const totalY = tableTop + rowHeight * 4 + 42;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(
    `Total Amount Due Through ${formatLongDate(statement.goodThroughDate)}:`,
    margin,
    totalY
  );
  doc.setFontSize(16);
  doc.text(formatMoney(statement.totalPayoff), pageWidth - margin, totalY, {
    align: "right",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const paragraph =
    `This payoff is valid through ${formatLongDate(statement.goodThroughDate)}. ` +
    `After that date, add ${formatMoney(statement.perDiemInterest)} per day until ` +
    "the loan is paid in full. Please request an updated payoff if payment is " +
    "received after the good-through date.";
  doc.text(doc.splitTextToSize(paragraph, tableWidth), margin, totalY + 38, {
    lineHeightFactor: 1.35,
  });

  doc.text("Sincerely,", margin, totalY + 102);
  doc.setFont("helvetica", "bold");
  doc.text(COMPANY_NAME, margin, totalY + 132);

  return doc;
}

export async function downloadPayoffStatementPdf(statement: PayoffStatement) {
  const doc = await createPayoffStatementPdf(statement);
  const borrowerSlug = statement.borrowerName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  const [month, day, year] = statement.goodThroughDate.split("/");
  const dateSlug = `${year}-${month}-${day}`;
  doc.save(`payoff-statement-${borrowerSlug || "borrower"}-${dateSlug}.pdf`);
}
