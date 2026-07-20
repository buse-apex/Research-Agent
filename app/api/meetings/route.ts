import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Anthropic from "@anthropic-ai/sdk";
import { authOptions } from "@/lib/auth";
import { buildMeetingsPrompt } from "@/lib/meetingsPrompt";
import { sanitizeUrls } from "@/lib/fetchUrls";
import { extractJson, sanitizeJson, tryParse } from "@/lib/json";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-5";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const schoolName = String(body.schoolName || "").trim().slice(0, 160);
  const location = String(body.location || "").trim().slice(0, 160);
  if (!schoolName || !location) {
    return NextResponse.json({ error: "School name and location are required." }, { status: 400 });
  }
  const extraUrls = sanitizeUrls(body.extraUrls);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    let messages: any[] = [
      { role: "user", content: buildMeetingsPrompt({ schoolName, location, extraUrls }) },
    ];
    let res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      messages,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 } as any],
    });

    let guard = 0;
    while ((res.stop_reason as string) === "pause_turn" && guard < 3) {
      messages = [...messages, { role: "assistant", content: res.content }];
      res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4000,
        messages,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 } as any],
      });
      guard++;
    }

    const text = res.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");

    const candidate = extractJson(text);
    const parsed = tryParse(candidate) || tryParse(sanitizeJson(candidate));
    if (!parsed) {
      return NextResponse.json(
        { error: "The meeting check came back malformed. Please try again." },
        { status: 502 }
      );
    }
    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("Meetings check error:", err);
    const status = err?.status === 429 ? 429 : 500;
    const msg =
      status === 429
        ? "Rate limit reached. Wait a minute and try again."
        : "The meeting check failed. Please try again.";
    return NextResponse.json({ error: msg }, { status });
  }
}
