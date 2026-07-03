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

const RESEARCH_MODEL = "claude-sonnet-5";
const REPAIR_MODEL = "claude-haiku-4-5"; // syntax repair needs speed, not depth

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

  const schoolName = String(body.schoolName || "").trim().slice(0, 120);
  const location = String(body.location || "").trim().slice(0, 80);
  const franchiseeName = String(body.franchiseeName || "").trim().slice(0, 120);

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
      model: RESEARCH_MODEL,
      max_tokens: 16000, // the brief + personalization bank is long; 8000 risked mid-JSON truncation
      messages: [{ role: "user", content: prompt }],
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 12, // enough for 3 research phases, bounds cost per run
        } as any,
      ],
    });

    // If the model ran out of output tokens, the JSON is truncated — repair
    // cannot recover lost content, so tell the user to rerun instead.
    if (response.stop_reason === "max_tokens") {
      console.error("Research output truncated at max_tokens");
      return NextResponse.json(
        { error: "The research brief came back incomplete. Please run it again." },
        { status: 500 }
      );
    }

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

    // Parse JSON from the response (multi-stage: parse → extract → sanitize → model repair)
    const parsed = await parseModelJson(text);
    if (!parsed) {
      return NextResponse.json(
        { error: "The agent's output could not be read. Please run the research again." },
        { status: 500 }
      );
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

// ---------- Robust JSON handling ----------

function tryParse(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function extractJson(text: string): string {
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return cleaned;
  return cleaned.slice(start, end + 1);
}

// Escapes raw control characters (newlines, tabs) that appear INSIDE string
// literals — the most common cause of "Expected ',' or ']'" parse errors when
// a model copies multi-line text into a JSON string.
function sanitizeJson(s: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
      } else if (ch === "\\") {
        out += ch;
        escaped = true;
      } else if (ch === '"') {
        out += ch;
        inString = false;
      } else if (ch === "\n") {
        out += "\\n";
      } else if (ch === "\r") {
        out += "\\r";
      } else if (ch === "\t") {
        out += "\\t";
      } else {
        out += ch;
      }
    } else {
      out += ch;
      if (ch === '"') inString = true;
    }
  }
  return out;
}

async function parseModelJson(text: string): Promise<any | null> {
  const candidate = extractJson(text);

  // Stage 1: direct parse
  let parsed = tryParse(candidate);
  if (parsed) return parsed;

  // Stage 2: sanitize control characters inside strings
  parsed = tryParse(sanitizeJson(candidate));
  if (parsed) return parsed;

  // Stage 3: ask the model to repair its own output (no tools, cheap, fast)
  try {
    const repair = await anthropic.messages.create({
      model: REPAIR_MODEL,
      max_tokens: 8000,
      messages: [
        {
          role: "user",
          content:
            "The following text is meant to be a single valid JSON object but has a syntax error. " +
            "Return ONLY the corrected JSON object — no markdown fences, no commentary. " +
            "Preserve all content exactly; fix only the JSON syntax (escaping, commas, brackets).\n\n" +
            candidate,
        },
      ],
    });
    const repairText = repair.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");
    parsed = tryParse(extractJson(repairText));
    if (parsed) return parsed;
    parsed = tryParse(sanitizeJson(extractJson(repairText)));
    if (parsed) return parsed;
  } catch (e) {
    console.error("JSON repair pass failed:", e);
  }

  return null;
}
