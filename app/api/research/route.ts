import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Anthropic from "@anthropic-ai/sdk";
import { authOptions } from "@/lib/auth";
import { logResearchRequest } from "@/lib/db";
import { buildResearchPrompt } from "@/lib/prompt";

export const maxDuration = 300; // 5 minutes for long research

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(req: NextRequest) {
  // Verify session
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { schoolName, location, franchiseeName } = body;

  if (!schoolName || !location) {
    return NextResponse.json(
      { error: "schoolName and location are required" },
      { status: 400 }
    );
  }

  const prompt = buildResearchPrompt({
    schoolName,
    location,
    franchiseeName: franchiseeName || "",
  });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
        } as any,
      ],
    });

    // Extract text from response
    const text = response.content
      .filter((block: any) => block.type === "text")
      .map((block: any) => block.text)
      .join("\n");

    if (!text) {
      return NextResponse.json(
        { error: "Empty response from the model" },
        { status: 500 }
      );
    }

    // Parse JSON from the response
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) {
        return NextResponse.json(
          { error: "Could not parse model output" },
          { status: 500 }
        );
      }
      parsed = JSON.parse(match[0]);
    }

    // Log to database
    let briefId: number | null = null;
    try {
      briefId = await logResearchRequest({
        userEmail: session.user.email,
        userName: session.user.name || null,
        schoolName,
        schoolLocation: location,
        franchiseeName: franchiseeName || null,
        briefData: parsed,
      });
    } catch (dbErr) {
      console.error("DB log failed:", dbErr);
      // Don't fail the request if logging fails
    }

    return NextResponse.json({ ...parsed, briefId });
  } catch (err: any) {
    console.error("Research error:", err);
    return NextResponse.json(
      { error: err.message || "Research failed" },
      { status: 500 }
    );
  }
}
