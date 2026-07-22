import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Anthropic from "@anthropic-ai/sdk";
import { authOptions } from "@/lib/auth";
import { logResearchRequest } from "@/lib/db";
import { buildResearchPrompt, buildFormatPrompt } from "@/lib/prompt";
import { sanitizeUrls, fetchUrls, renderFetchedContext } from "@/lib/fetchUrls";
import { splitSocialUrls, discoverFacebookUrl, scrapeFacebookPosts, renderSocialContext, SocialResult } from "@/lib/social";

export const maxDuration = 300; // 5 minutes for long research

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const RESEARCH_MODEL = "claude-sonnet-5";
const REPAIR_MODEL = "claude-haiku-4-5"; // syntax repair needs speed, not depth
const VERIFY_MODEL = "claude-haiku-4-5"; // verification is narrow checking work: fast model, big time savings

// ---- TIME BUDGET GOVERNOR ----
// Vercel caps this function at 300s. We track elapsed time and adapt so the
// run ALWAYS finishes: the verification pass only runs if enough budget
// remains, and skipping is visible in the brief (facts downgrade to
// single_source), never silent.
const TOTAL_BUDGET_MS = 290000; // leave headroom under the 300s ceiling
const VERIFY_MIN_REMAINING_MS = 100000; // verification needs at least this much left
const FORMAT_RESERVED_MS = 60000; // always reserve time for the format call
const RESEARCH_DEADLINE_MS = 175000; // research (incl. continuations) must wrap by here
const CONTINUATION_MAX_USES = 4; // continuations refine, they don't get a fresh full budget

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
  const extraUrls = sanitizeUrls(body.extraUrls);
  const includeSocial = body.includeSocial === true;

  if (!schoolName || !location) {
    return NextResponse.json(
      { error: "schoolName and location are required" },
      { status: 400 }
    );
  }

  const startedAt = Date.now();
  const elapsed = () => Date.now() - startedAt;

  // Social URLs are login-walled and cannot be plain-fetched; route them to
  // the Apify deep dive instead (when enabled) and plain-fetch the rest.
  const { social: socialUrls, regular: regularUrls } = splitSocialUrls(extraUrls);

  // Guaranteed fetch of any franchisee-supplied non-social URLs (isolated failures).
  const fetchedPages = await fetchUrls(regularUrls);
  let fetchedContext = renderFetchedContext(fetchedPages);

  // Optional social media deep dive (Apify). Fails gracefully in every branch.
  let socialResult: SocialResult | null = null;
  if (includeSocial) {
    let fbUrl = socialUrls.find((u) => /facebook\.com/i.test(u)) || null;
    if (!fbUrl) {
      fbUrl = await discoverFacebookUrl(anthropic, REPAIR_MODEL, schoolName, location);
    }
    socialResult = fbUrl
      ? await scrapeFacebookPosts(fbUrl)
      : { ok: false, note: "No official Facebook page could be found for this school." };
  } else if (socialUrls.length) {
    // Deep dive off, but social links were pasted: surface them for manual checking.
    fetchedContext +=
      (fetchedContext ? "\n\n----\n\n" : "") +
      `FRANCHISEE-PROVIDED SOCIAL LINKS (content not fetched; social pages block automated reading): ${socialUrls.join(
        ", "
      )}. Include these in the brief's social links so the franchisee can check them manually. Do not invent their contents.`;
  }
  const socialContext = renderSocialContext(socialResult);

  const researchPrompt = buildResearchPrompt({ schoolName, location, fetchedContext, socialContext });

  try {
    // ---- CALL 1: research with web search; output is a plain-text dossier ----
    // Heavy pre-stages (URL fetch, social scrape) eat the clock before research
    // starts; shrink the search budget accordingly so the total always fits.
    const researchMaxUses = elapsed() > 45000 ? 6 : 8;
    const tools = [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: researchMaxUses,
      } as any,
    ];
    const continuationTools = [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: CONTINUATION_MAX_USES,
      } as any,
    ];

    let messages: any[] = [{ role: "user", content: researchPrompt }];
    let research = await anthropic.messages.create({
      model: RESEARCH_MODEL,
      max_tokens: 20000,
      messages,
      tools,
    });

    // Long research turns can pause; continue until the turn completes,
    // the continuation cap is hit, or the research deadline arrives.
    let continuations = 0;
    while (
      (research.stop_reason as string) === "pause_turn" &&
      continuations < 3 &&
      elapsed() < RESEARCH_DEADLINE_MS
    ) {
      messages = [...messages, { role: "assistant", content: research.content }];
      research = await anthropic.messages.create({
        model: RESEARCH_MODEL,
        max_tokens: 20000,
        messages,
        tools: continuationTools,
      });
      continuations++;
    }
    if ((research.stop_reason as string) === "pause_turn") {
      console.warn(`Research stopped at deadline/cap (${Math.round(elapsed() / 1000)}s in); proceeding with gathered material.`);
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

    // ---- CALL 1.5: INDEPENDENT VERIFICATION PASS ----
    // A fresh model instance adversarially re-checks the dossier's key claims.
    // It has no attachment to the original claims: its job is to confirm,
    // correct, or mark unverifiable. Its report is appended to the dossier.
    let verificationReport = "";
    const remainingForVerify = TOTAL_BUDGET_MS - elapsed() - FORMAT_RESERVED_MS;
    if (remainingForVerify < VERIFY_MIN_REMAINING_MS) {
      console.warn(`Skipping verification: only ${Math.round(remainingForVerify / 1000)}s of budget left`);
      verificationReport =
        "VERIFICATION PASS SKIPPED: the research phase used most of the time budget this run. Treat all claims as single_source and note in the bank description that verification did not run.";
    } else try {
      const verifyPrompt = `You are an adversarial fact-checker. Below is a research dossier about ${schoolName} in ${location}, prepared for cold outreach. Your ONLY job is to re-verify its key claims with fresh web searches. Assume nothing in it is true until you confirm it.

VERIFY THESE CLAIM TYPES, in priority order:
1. The school identity block (official name, district, grade span)
2. Every named person and their role (especially the principal and PTA officers)
3. The current fundraiser and any vendor history claims
4. Every quotation (find the quoted text; if you cannot find it verbatim, flag it)
5. Dated facts and amounts (events, achievements, money trail)

For each claim you check, output one line:
CONFIRMED: <claim> [source: URL]
CORRECTED: <original claim> -> <corrected version> [source: URL]
UNVERIFIABLE: <claim> (searched, could not confirm)

Check as many claims as your search budget allows, prioritizing the claim types in order. Do not add new research topics. Do not soften: if a claim is wrong, say CORRECTED; if you cannot find support, say UNVERIFIABLE. End with one line starting "SUMMARY:" describing overall reliability.

=== DOSSIER TO VERIFY ===
${dossier}
=== END DOSSIER ===`;

      let vMessages: any[] = [{ role: "user", content: verifyPrompt }];
      let vRes = await anthropic.messages.create({
        model: VERIFY_MODEL,
        max_tokens: 8000,
        messages: vMessages,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 } as any],
      });
      let vGuard = 0;
      while ((vRes.stop_reason as string) === "pause_turn" && vGuard < 3) {
        vMessages = [...vMessages, { role: "assistant", content: vRes.content }];
        vRes = await anthropic.messages.create({
          model: VERIFY_MODEL,
          max_tokens: 8000,
          messages: vMessages,
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 } as any],
        });
        vGuard++;
      }
      verificationReport = vRes.content
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("\n")
        .trim();
    } catch (vErr) {
      console.error("Verification pass failed; proceeding without it:", vErr);
      verificationReport = "VERIFICATION PASS FAILED TO RUN. Treat single-source claims with extra caution and mark them accordingly.";
    }

    const verifiedDossier = dossier + "\n\n=== INDEPENDENT VERIFICATION REPORT ===\n" + verificationReport;

    // ---- CALL 2: no tools; converts the dossier into the brief JSON ----
    const formatPrompt = buildFormatPrompt({
      schoolName,
      location,
      franchiseeName,
      dossier: verifiedDossier,
    });

    const format = await anthropic.messages.create({
      model: RESEARCH_MODEL,
      max_tokens: 16000,
      messages: [{ role: "user", content: formatPrompt }],
    });

    if (format.stop_reason === "max_tokens") {
      console.error("Format output truncated at max_tokens");
      return NextResponse.json(
        { error: "The research brief came back incomplete. Please run it again." },
        { status: 500 }
      );
    }

    const text = format.content
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
