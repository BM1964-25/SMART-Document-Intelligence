import { NextResponse } from "next/server";
import { readData } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await readData();
  return NextResponse.json(data);
}
