// Turning a schedule into a file someone can hand off — a call sheet in
// spreadsheet or PDF form, for people who live outside this app. Same rows,
// three shapes: CSV (opens directly in Google Sheets via File → Import, no
// separate Sheets integration needed), a real .xlsx, and a printable PDF.

import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { formatScheduleDate, addCalendarDays } from "./work-calendar";
import { PROJECT_COLOR_HEX } from "@/lib/display";
import type { ExportAssignmentRow } from "./queries";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

/** Sun–Sat weeks covering the month, including adjacent-month bleed. */
function buildWeeks(monthStart: Date): Date[][] {
  const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0));
  const gridStart = addCalendarDays(monthStart, -monthStart.getUTCDay());
  const gridEnd = addCalendarDays(monthEnd, 6 - monthEnd.getUTCDay());
  const weeks: Date[][] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(cursor);
      cursor = addCalendarDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/**
 * Place bars into lanes within one week so overlapping bars never sit on top
 * of each other — same first-fit approach the on-screen calendar uses.
 */
function packLanes<T extends { startCol: number; span: number }>(segments: T[]): T[][] {
  const lanes: T[][] = [];
  for (const seg of segments) {
    let placed = false;
    for (const lane of lanes) {
      const clashes = lane.some(
        (s) => seg.startCol < s.startCol + s.span && s.startCol < seg.startCol + seg.span
      );
      if (!clashes) {
        lane.push(seg);
        placed = true;
        break;
      }
    }
    if (!placed) lanes.push([seg]);
  }
  return lanes;
}

/** Every calendar month a schedule's rows touch, earliest to latest — the current month alone if there are no rows. */
function monthsSpanned(rows: ExportAssignmentRow[]): Date[] {
  if (rows.length === 0) {
    const now = new Date();
    return [new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))];
  }
  let min = rows[0].startDate;
  let max = rows[0].endDate;
  for (const r of rows) {
    if (r.startDate < min) min = r.startDate;
    if (r.endDate > max) max = r.endDate;
  }
  const months: Date[] = [];
  const end = new Date(Date.UTC(max.getUTCFullYear(), max.getUTCMonth(), 1));
  let cursor = new Date(Date.UTC(min.getUTCFullYear(), min.getUTCMonth(), 1));
  while (cursor <= end) {
    months.push(cursor);
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return months;
}

/**
 * A printable version of the actual calendar grid people work in day to
 * day — month pages of Sun–Sat weeks with each placement drawn as a colored
 * bar across the days it covers — rather than a flat list of rows. The
 * spreadsheet formats (CSV/XLSX) stay tabular, since that's what a person
 * re-importing the data wants; a PDF is for handing to someone who wants to
 * glance at what a month looks like, the same way the on-screen calendar
 * reads.
 */
export async function toPdfBuffer(
  rows: ExportAssignmentRow[],
  variationName: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: "LETTER", layout: "landscape" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const startX = doc.page.margins.left;
    const gridWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = gridWidth / 7;
    const bottomLimit = doc.page.height - doc.page.margins.bottom;
    const DAY_LABEL_HEIGHT = 16;
    const LANE_HEIGHT = 13;
    const WEEK_GAP = 4;

    function drawWeekdayHeader(y: number): number {
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#666666");
      for (let i = 0; i < 7; i++) {
        doc.text(WEEKDAYS[i], startX + i * colWidth + 4, y, { width: colWidth - 8 });
      }
      const lineY = y + 13;
      doc.moveTo(startX, lineY).lineTo(startX + gridWidth, lineY).strokeColor("#cccccc").stroke();
      doc.fillColor("#000000");
      return lineY + 5;
    }

    const months = monthsSpanned(rows);
    months.forEach((monthStart, monthIndex) => {
      if (monthIndex > 0) doc.addPage();

      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor("#000000")
        .text(
          `${variationName} — ${monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}`,
          startX,
          doc.page.margins.top
        );
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#666666")
        .text(`Generated ${new Date().toLocaleString("en-US", { timeZone: "UTC" })} UTC`);
      doc.fillColor("#000000");

      let y = drawWeekdayHeader(doc.y + 8);

      for (const week of buildWeeks(monthStart)) {
        const weekStart = week[0];
        const weekEnd = week[6];

        const segments = rows
          .map((a) => {
            if (a.endDate < weekStart || a.startDate > weekEnd) return null;
            const clippedStart = a.startDate < weekStart ? weekStart : a.startDate;
            const clippedEnd = a.endDate > weekEnd ? weekEnd : a.endDate;
            return {
              row: a,
              startCol: clippedStart.getUTCDay(),
              span: Math.round((clippedEnd.getTime() - clippedStart.getTime()) / MS_PER_DAY) + 1,
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
          .sort((a, b) => a.startCol - b.startCol || a.row.startDate.getTime() - b.row.startDate.getTime());

        const lanes = packLanes(segments);
        const weekHeight = DAY_LABEL_HEIGHT + lanes.length * LANE_HEIGHT + WEEK_GAP;

        if (y + weekHeight > bottomLimit) {
          doc.addPage();
          y = drawWeekdayHeader(doc.page.margins.top);
        }

        for (let i = 0; i < 7; i++) {
          const day = week[i];
          const inMonth = day.getUTCMonth() === monthStart.getUTCMonth();
          const x = startX + i * colWidth;
          doc.rect(x, y, colWidth, weekHeight).strokeColor("#e5e5e5").stroke();
          doc
            .font("Helvetica")
            .fontSize(8)
            .fillColor(inMonth ? "#333333" : "#bbbbbb")
            .text(String(day.getUTCDate()), x + 4, y + 2);
        }

        let laneY = y + DAY_LABEL_HEIGHT;
        for (const lane of lanes) {
          for (const seg of lane) {
            const x = startX + seg.startCol * colWidth + 1;
            const w = seg.span * colWidth - 2;
            const color = seg.row.projectColor ? PROJECT_COLOR_HEX[seg.row.projectColor] : "#8b5cf6";
            doc.roundedRect(x, laneY, w, LANE_HEIGHT - 2, 2).fill(color);
            doc
              .font("Helvetica")
              .fontSize(7)
              .fillColor("#ffffff")
              .text(`${seg.row.projectName} · ${seg.row.label}`, x + 3, laneY + 2, {
                width: w - 6,
                height: LANE_HEIGHT - 4,
                ellipsis: true,
                lineBreak: false,
              });
          }
          laneY += LANE_HEIGHT;
        }

        y += weekHeight;
      }
    });

    if (rows.length === 0) {
      doc.font("Helvetica").fontSize(10).fillColor("#666666").text("Nothing scheduled.", startX, doc.y + 10);
    }

    doc.end();
  });
}
