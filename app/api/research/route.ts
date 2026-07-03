import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Anthropic from "@anthropic-ai/sdk";
import { authOptions } from "@/lib/auth";
import { logResearchRequest } from "@/lib/db";
import { buildResearchPrompt, buildFormatPrompt } from "@/lib/prompt";

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

  const researchPrompt = buildResearchPrompt({ schoolName, location });

  try {
    // ---- CALL 1: research with web search; output is a plain-text dossier ----
    const tools = [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 8, // enough for 3 research phases, bounds cost and rate-limit pressure
      } as any,
    ];

    let messages: any[] = [{ role: "user", content: researchPrompt }];
    let research = await anthropic.messages.create({
      model: RESEARCH_MODEL,
      max_tokens: 20000,
      messages,
      tools,
    });

    // Long research turns can pause; continue until the turn completes.
    let continuations = 0;
    while ((research.stop_reason as string) === "pause_turn" && continuations < 4) {
      messages = [...messages, { role: "assistant", content: research.content }];
      research = await anthropic.messages.create({
        model: RESEARCH_MODEL,
        max_tokens: 20000,
        messages,
        tools,
      });
      continuations++;
    }

    const dossier = research.content
      .filter((block: any) => block.type === "text")
      .map((block: any) => block.text)
      .join("\n")
      .trim();

    if (!dossier || dossier.length < 200) {
      return NextResponse.json(
        { error: "The research pass came back empty. Please run it again." },
        { status: 500 }
      );
    }

    // ---- CALL 2: no tools, temperature 0, prefilled "{" — reliable JSON ----
    const formatPrompt = buildFormatPrompt({
      schoolName,
      location,
      franchiseeName,
      dossier,
    });

    const format = await anthropic.messages.create({
      model: RESEARCH_MODEL,
      max_tokens: 16000,
      temperature: 0,
      messages: [
        { role: "user", content: formatPrompt },
        { role: "assistant", content: "{" }, // prefill: forces output to start as JSON
      ],
    });

    if (format.stop_reason === "max_tokens") {
      console.error("Format output truncated at max_tokens");
      return NextResponse.json(
        { error: "The research brief came back incomplete. Please run it again." },
        { status: 500 }
      );
    }

    const text =
      "{" +
      format.content
        .filter((block: any) => block.type === "text")
        .map((block: any) => block.text)
        .join("\n");

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
    const msg = String(err?.message || "");
    if (err?.status === 429 || msg.includes("rate_limit")) {
      return NextResponse.json(
        {
          error:
            "The Apex API rate limit was reached. Wait a couple of minutes and try again. If this keeps happening, the organization's rate limit tier needs to be raised at console.anthropic.com/settings/limits.",
        },
        { status: 429 }
      );
    }
    const friendly =
      msg.includes("JSON") || msg.includes("Unexpected token") || msg.includes("position")
        ? "The brief could not be assembled this time. Please run the research again."
        : msg.includes("timeout") || msg.includes("504")
        ? "The research took too long and timed out. Please try again."
        : "Research failed. Please try again.";
    return NextResponse.json({ error: friendly }, { status: 500 });
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
