// Turning a schedule into a file someone can hand off — a call sheet in
// spreadsheet or PDF form, for people who live outside this app. Same rows,
// three shapes: CSV (opens directly in Google Sheets via File → Import, no
// separate Sheets integration needed), a real .xlsx, and a printable PDF.

import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { formatScheduleDate } from "./work-calendar";
import type { ExportAssignmentRow } from "./queries";

const KIND_LABEL: Record<string, string> = {
  UNIT_PRODUCTION: "Unit Production",
  PRODUCTION_EVENT: "Production Event",
};

interface ExportRow {
  project: string;
  label: string;
  kind: string;
  startDate: string;
  endDate: string;
  durationDays: number;
}

function toExportRows(rows: ExportAssignmentRow[]): ExportRow[] {
  return rows.map((r) => ({
    project: r.projectName,
    label: r.label,
    kind: KIND_LABEL[r.kind] ?? r.kind,
    startDate: formatScheduleDate(r.startDate),
    endDate: formatScheduleDate(r.endDate),
    durationDays: r.durationDays,
  }));
}

const COLUMNS = [
  { key: "project", header: "Project", width: 26 },
  { key: "label", header: "Item", width: 30 },
  { key: "kind", header: "Type", width: 18 },
  { key: "startDate", header: "Start", width: 14 },
  { key: "endDate", header: "End", width: 14 },
  { key: "durationDays", header: "Duration (days)", width: 16 },
] as const;

function csvCell(value: string | number): string {
  const s = String(value);
  // Always quote: simplest way to be correct for every field without
  // special-casing which ones might contain a comma, quote, or newline.
  return `"${s.replace(/"/g, '""')}"`;
}

// No variation name here, unlike the xlsx/pdf exporters below — a leading
// title line would break most CSV parsers' header detection, so the name
// lives only in the filename for this format.
export function toCsv(rows: ExportAssignmentRow[]): string {
  const data = toExportRows(rows);
  const lines = [
    COLUMNS.map((c) => csvCell(c.header)).join(","),
    ...data.map((row) =>
      COLUMNS.map((c) => csvCell(row[c.key as keyof ExportRow])).join(",")
    ),
  ];
  return lines.join("\r\n") + "\r\n";
}

export async function toXlsxBuffer(
  rows: ExportAssignmentRow[],
  variationName: string
): Promise<Buffer> {
  const data = toExportRows(rows);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Zero Gravity Media";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(variationName.slice(0, 31) || "Schedule");
  sheet.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  sheet.getRow(1).font = { bold: true };
  sheet.addRows(data);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function toPdfBuffer(
  rows: ExportAssignmentRow[],
  variationName: string
): Promise<Buffer> {
  const data = toExportRows(rows);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: "LETTER", layout: "landscape" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text(`${variationName} — Production Schedule`, { continued: false });
    doc
      .fontSize(9)
      .fillColor("#666666")
      .text(`Generated ${new Date().toLocaleString("en-US", { timeZone: "UTC" })} UTC`);
    doc.moveDown(1);
    doc.fillColor("#000000");

    const colWidths = [140, 170, 110, 80, 80, 90];
    const startX = doc.page.margins.left;
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    let y = doc.y;

    function drawHeader() {
      doc.font("Helvetica-Bold").fontSize(9);
      let x = startX;
      for (let i = 0; i < COLUMNS.length; i++) {
        doc.text(COLUMNS[i].header, x, y, { width: colWidths[i] });
        x += colWidths[i];
      }
      y += 16;
      doc
        .moveTo(startX, y - 3)
        .lineTo(startX + tableWidth, y - 3)
        .strokeColor("#cccccc")
        .stroke();
      doc.font("Helvetica").fontSize(9);
    }

    drawHeader();

    const bottomLimit = doc.page.height - doc.page.margins.bottom;
    for (const row of data) {
      if (y + 16 > bottomLimit) {
        doc.addPage();
        y = doc.page.margins.top;
        drawHeader();
      }
      let x = startX;
      const cells = [
        row.project,
        row.label,
        row.kind,
        row.startDate,
        row.endDate,
        String(row.durationDays),
      ];
      for (let i = 0; i < cells.length; i++) {
        doc.text(cells[i], x, y, { width: colWidths[i] });
        x += colWidths[i];
      }
      y += 16;
    }

    if (data.length === 0) {
      doc.fillColor("#666666").text("Nothing scheduled.", startX, y);
    }

    doc.end();
  });
}
