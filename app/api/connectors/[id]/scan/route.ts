import { NextResponse } from "next/server";
import { scanConnector } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await scanConnector(id);
  return NextResponse.json(result);
}
