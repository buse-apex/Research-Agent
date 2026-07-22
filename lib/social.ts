// Optional social media deep dive via Apify.
// Flow: find the school's official Facebook page (or use one the franchisee
// pasted), scrape recent posts through Apify's Facebook Posts Scraper, and
// render them as prompt context. Every step degrades gracefully: if discovery,
// scraping, or Apify itself fails, the research proceeds without social data
// and the model is told social could not be fetched (so it never invents posts).

import type Anthropic from "@anthropic-ai/sdk";

const APIFY_ACTOR = "apify~facebook-posts-scraper";
const APIFY_TIMEOUT_MS = 60000; // hard cap so social can never sink the run
const POSTS_FETCH_LIMIT = 90; // deep enough to span the school year on most pages
const KEEP_RECENT_MAX = 15;   // recent-window posts to keep (last 2 months)
const KEEP_SIGNAL_MAX = 12;   // fundraiser-signal posts to keep (school year)
const RECENT_WINDOW_DAYS = 62; // "last 2 months"
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
    )}&timeout=55`;
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

    // Two buckets, per the product spec:
    // 1) RECENT WINDOW (last ~2 months): events, announcements, asks, and
    //    engaging posts, the school's life right now, for openers and P.S. material.
    // 2) FUNDRAISER SIGNALS (current school year): vendor and money evidence,
    //    however far back in the fetched set it sits.
    const SIGNALS = /fundrais|donat|pledge|raised|\$\s?\d|dollar|goal|sponsor|auction|gala|carnival|fun run|glow run|color run|color games|boosterthon|jog.?a.?thon|walk.?a.?thon|read.?a.?thon|catalog|cookie dough|wrapping paper|book fair|pta|pto|booster/i;

    const now = Date.now();
    const recentCutoff = now - RECENT_WINDOW_DAYS * 86400000;
    // School year starts Aug 1: before August, it began last calendar year.
    const nowD = new Date();
    const syStartYear = nowD.getMonth() >= 7 ? nowD.getFullYear() : nowD.getFullYear() - 1;
    const schoolYearStart = new Date(syStartYear, 7, 1).getTime();

    const postTime = (p: SocialPost): number | null => {
      if (!p.date) return null;
      const t = Date.parse(p.date);
      return isNaN(t) ? null : t;
    };

    // Bucket 1: everything from the recent window (undated posts near the top
    // of the feed are treated as recent, feeds are reverse-chronological).
    const recentPosts = all
      .filter((p, idx) => {
        const t = postTime(p);
        return t !== null ? t >= recentCutoff : idx < 10;
      })
      .slice(0, KEEP_RECENT_MAX);

    // Bucket 2: fundraiser signals from the school year (or undated), not already kept.
    const signalPosts = all
      .filter((p) => {
        if (recentPosts.includes(p)) return false;
        if (!SIGNALS.test(p.text)) return false;
        const t = postTime(p);
        return t === null || t >= schoolYearStart;
      })
      .slice(0, KEEP_SIGNAL_MAX);

    const posts = [...recentPosts, ...signalPosts];
    (posts as any)._recentCount = recentPosts.length;

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
  const postsArr = result.posts || [];
  const recentCount = (postsArr as any)._recentCount ?? postsArr.length;
  const fmt = (p: SocialPost) => {
    const date = p.date ? `[${p.date}] ` : "";
    return `- ${date}${p.text}${p.url ? ` (${p.url})` : ""}`;
  };
  const recentLines = postsArr.slice(0, recentCount).map(fmt);
  const signalLines = postsArr.slice(recentCount).map(fmt);
  const lines = [
    "RECENT WINDOW (last ~2 months): the school's life right now. Mine these for events, announcements, asks, engaging moments, named people, and the school's voice; this is prime opener and P.S. material.",
    ...recentLines,
    ...(signalLines.length
      ? ["", "FUNDRAISER SIGNALS (from this school year): vendor and money evidence. Mine these for the money trail, vendor history, and amounts (with dates).", ...signalLines]
      : []),
  ];
  return `SOCIAL MEDIA (Facebook posts, fetched for you from ${result.pageUrl}):
Treat these as primary, dated source material and cite the page as a deep-read source.
FUNDRAISER SIGNALS ARE THE PRIORITY: posts mentioning fundraisers, donations, amounts raised, goals, and what the money bought are listed first below. Amounts the school raised with their own fundraisers are VALUABLE INTEL: capture them with their year in the money trail, the angle, and the bank. (The only money restriction is unchanged and applies to emails: no specific dollar figures or multipliers about what schools raise with Apex; approved phrases only. Keep specific dollar figures out of the email drafts.)

${lines.join("\n")}`;
}
