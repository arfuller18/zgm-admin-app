import { NextRequest } from "next/server";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { loadAllAssignments } from "@/lib/scheduling/queries";
import { toCsv, toXlsxBuffer, toPdfBuffer } from "@/lib/scheduling/export";

// pdfkit and exceljs need real Node APIs (fs, Buffer) — this can't run on
// the Edge runtime.
export const runtime = "nodejs";

const FORMATS = ["csv", "xlsx", "pdf"] as const;
type Format = (typeof FORMATS)[number];

function isFormat(v: string | null): v is Format {
  return v !== null && (FORMATS as readonly string[]).includes(v);
}

function filenameSafe(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "schedule";
}

export async function GET(req: NextRequest) {
  await requireUser();

  const { searchParams } = new URL(req.url);
  const variationId = searchParams.get("variationId");
  const format = searchParams.get("format");
  const projectId = searchParams.get("projectId") ?? undefined;

  if (!variationId || !isFormat(format)) {
    return new Response("variationId and a valid format (csv, xlsx, pdf) are required.", {
      status: 400,
    });
  }

  const variation = await prisma.scheduleVariation.findUnique({
    where: { id: variationId },
    select: { name: true },
  });
  if (!variation) return new Response("Variation not found.", { status: 404 });

  const rows = await loadAllAssignments(variationId, projectId);
  const filename = `${filenameSafe(variation.name)}-schedule.${format}`;

  if (format === "csv") {
    return new Response(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  if (format === "xlsx") {
    const buffer = await toXlsxBuffer(rows, variation.name);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const buffer = await toPdfBuffer(rows, variation.name);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
