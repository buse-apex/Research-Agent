// Optional social media deep dive via Apify.
// Flow: find the school's official Facebook page (or use one the franchisee
// pasted), scrape recent posts through Apify's Facebook Posts Scraper, and
// render them as prompt context. Every step degrades gracefully: if discovery,
// scraping, or Apify itself fails, the research proceeds without social data
// and the model is told social could not be fetched (so it never invents posts).

import type Anthropic from "@anthropic-ai/sdk";

const APIFY_ACTOR = "apify~facebook-posts-scraper";
const APIFY_TIMEOUT_MS = 90000; // hard cap so social can never sink the run
const POSTS_FETCH_LIMIT = 60; // scan deep
const POSTS_KEEP_SIGNAL = 14; // fundraiser-signal posts to keep
const POSTS_KEEP_RECENT = 6;  // most recent other posts for voice/context
const MAX_POST_CHARS = 500;

export interface SocialPost {
  date?: string;
  text: string;
  url?: string;
}

export interface SocialResult {
  ok: boolean;
  pageUrl?: string;
  posts?: SocialPost[];
  note?: string; // human-readable reason when ok=false
}

export function splitSocialUrls(urls: string[]): { social: string[]; regular: string[] } {
  const social: string[] = [];
  const regular: string[] = [];
  for (const u of urls) {
    if (/facebook\.com|instagram\.com/i.test(u)) social.push(u);
    else regular.push(u);
  }
  return { social, regular };
}

// Cheap, fast discovery call: find the school's official Facebook page URL.
// Page URLs are indexed by search engines even though page CONTENT is blocked,
// so this is reliable where direct fetching is not.
export async function discoverFacebookUrl(
  anthropic: Anthropic,
  model: string,
  schoolName: string,
  location: string
): Promise<string | null> {
  try {
    const res = await anthropic.messages.create({
      model,
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `Find the official Facebook page URL of the school "${schoolName}" in ${location}, or of its PTA/PTO if the school has no page. Search the web. Respond with ONLY the URL (must contain facebook.com) or the word NONE. No other text.`,
        },
      ],
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 } as any],
    });
    const text = res.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join(" ");
    const match = text.match(/https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>)\]]+/i);
    return match ? match[0].replace(/[.,;]+$/, "") : null;
  } catch (e) {
    console.error("Facebook discovery failed:", e);
    return null;
  }
}

export async function scrapeFacebookPosts(pageUrl: string): Promise<SocialResult> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return { ok: false, note: "Social deep dive is not configured (missing APIFY_TOKEN)." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), APIFY_TIMEOUT_MS);
  try {
    const endpoint = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(
      token
    )}&timeout=80`;
    const res = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startUrls: [{ url: pageUrl }],
        resultsLimit: POSTS_FETCH_LIMIT,
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("Apify error:", res.status, t.slice(0, 300));
      return { ok: false, pageUrl, note: `Social scrape failed (Apify ${res.status}).` };
    }

    const items: any[] = await res.json();
    if (!Array.isArray(items) || items.length === 0) {
      return { ok: false, pageUrl, note: "No public posts could be retrieved from the page." };
    }

    const all: SocialPost[] = items
      .map((it) => ({
        date: it.time || it.date || it.publishedTime || undefined,
        text: String(it.text || it.message || "").slice(0, MAX_POST_CHARS),
        url: it.url || it.postUrl || undefined,
      }))
      .filter((p) => p.text.trim().length > 0);

    // Prioritize fundraiser and money signals over plain recency.
    const SIGNALS = /fundrais|donat|pledge|raised|\$\s?\d|dollar|goal|sponsor|auction|gala|carnival|fun run|glow run|color run|color games|boosterthon|jog.?a.?thon|walk.?a.?thon|read.?a.?thon|catalog|cookie dough|wrapping paper|book fair|pta|pto|booster/i;
    const signalPosts = all.filter((p) => SIGNALS.test(p.text)).slice(0, POSTS_KEEP_SIGNAL);
    const recentOthers = all
      .filter((p) => !signalPosts.includes(p))
      .slice(0, POSTS_KEEP_RECENT);
    const posts = [...signalPosts, ...recentOthers];

    if (!posts.length) {
      return { ok: false, pageUrl, note: "Posts were returned but contained no readable text." };
    }
    return { ok: true, pageUrl, posts };
  } catch (e: any) {
    const note =
      e?.name === "AbortError"
        ? "Social scrape timed out; continuing without it."
        : `Social scrape failed: ${e?.message || "unknown error"}.`;
    console.error("Apify scrape error:", e);
    return { ok: false, pageUrl, note };
  } finally {
    clearTimeout(timer);
  }
}

export function renderSocialContext(result: SocialResult | null): string {
  if (!result) return "";
  if (!result.ok) {
    return `SOCIAL MEDIA: The franchisee requested a social media deep dive, but it could not be completed (${
      result.note || "unknown reason"
    }). Do NOT invent social media content. Note the school's social links in the brief so the franchisee can check manually.`;
  }
  const lines = (result.posts || []).map((p) => {
    const date = p.date ? `[${p.date}] ` : "";
    return `- ${date}${p.text}${p.url ? ` (${p.url})` : ""}`;
  });
  return `SOCIAL MEDIA (recent Facebook posts, fetched for you from ${result.pageUrl}):
Treat these as primary, dated source material. Mine them for: current or upcoming fundraisers, what money raised is going toward, recent events, named people, and the school's voice. Cite the page as a deep-read source.
FUNDRAISER SIGNALS ARE THE PRIORITY: posts mentioning fundraisers, donations, amounts raised, goals, and what the money bought are listed first below. Amounts the school raised with their own fundraisers are VALUABLE INTEL: capture them with their year in the money trail, the angle, and the bank. (The only money restriction is unchanged and applies to emails: no specific dollar figures or multipliers about what schools raise with Apex; approved phrases only. Keep specific dollar figures out of the email drafts.)

${lines.join("\n")}`;
}
