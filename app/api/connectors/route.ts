import { NextResponse } from "next/server";
import { addConnector, readData } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await readData();
  return NextResponse.json({ connectors: data.connectors });
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body?.path || typeof body.path !== "string") {
    return NextResponse.json({ error: "Bitte einen lokalen Ordnerpfad angeben." }, { status: 400 });
  }

  const connector = await addConnector({
    name: typeof body.name === "string" ? body.name : "",
    path: body.path
  });

  return NextResponse.json({ connector }, { status: 201 });
}
