import { NextResponse } from "next/server";
import { createExportPayload } from "@/lib/store";

export const dynamic = "force-dynamic";

const allowedKinds = new Set(["management", "risks", "tasks", "deadlines", "documents"]);

export async function GET(request: Request, context: { params: Promise<{ kind: string }> }) {
  const { kind } = await context.params;
  if (!allowedKinds.has(kind)) {
    return NextResponse.json({ error: "Unbekannter Exporttyp." }, { status: 400 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "json";
  const payload = await createExportPayload(kind as "management" | "risks" | "tasks" | "deadlines" | "documents");

  if (format === "csv") {
    const rows = csvRowsFor(kind, payload);
    return new NextResponse(rows, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="smart-di-${kind}.csv"`
      }
    });
  }

  return NextResponse.json(payload, {
    headers: {
      "Content-Disposition": `attachment; filename="smart-di-${kind}.json"`
    }
  });
}

function csvRowsFor(kind: string, payload: {
  tasks: Record<string, unknown>[];
  deadlines: Record<string, unknown>[];
  risks: Record<string, unknown>[];
  documents: Record<string, unknown>[];
}) {
  const records =
    kind === "tasks" ? payload.tasks :
    kind === "deadlines" ? payload.deadlines :
    kind === "risks" ? payload.risks :
    payload.documents;

  if (records.length === 0) return "";
  const columns = Object.keys(records[0]);
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
  return [columns.join(","), ...records.map((record) => columns.map((column) => escape(record[column])).join(","))].join("\n");
}
