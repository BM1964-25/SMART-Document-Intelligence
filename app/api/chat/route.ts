import { NextResponse } from "next/server";
import { answerQuestion } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  const question = typeof body?.question === "string" ? body.question : "";
  if (!question.trim()) {
    return NextResponse.json({ error: "Bitte eine Frage eingeben." }, { status: 400 });
  }

  const answer = await answerQuestion(question);
  return NextResponse.json(answer);
}
