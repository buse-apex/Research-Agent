// Optional social media deep dive via Apify.
// Flow: find the school's official Facebook page (or use one the franchisee
// pasted), scrape recent posts through Apify's Facebook Posts Scraper, and
// render them as prompt context. Every step degrades gracefully: if discovery,
// scraping, or Apify itself fails, the research proceeds without social data
// and the model is told social could not be fetched (so it never invents posts).

import type Anthropic from "@anthropic-ai/sdk";

const APIFY_ACTOR = "apify~facebook-posts-scraper";
const APIFY_TIMEOUT_MS = 130000; // matches the 90-post ask; Pro budget absorbs it
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

// Discovery: find the Facebook page where this school's fundraising and
// parent-community life gets posted. This is a genuine two-step research task:
// PTA pages are usually named after the DISTRICT or parent organization, not
// the school ("Starpoint PTA" for Regan Intermediate), so the searcher must
// first learn who runs the school, then hunt that name.
export async function discoverFacebookUrl(
  anthropic: Anthropic,
  model: string,
  schoolName: string,
  location: string
): Promise<string | null> {
  try {
    const res = await anthropic.messages.create({
      model,
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `Find the Facebook page where fundraising and parent-community news for the school "${schoolName}" in ${location} gets posted. Work in two steps:

STEP 1: Search for the school to learn its school district or parent organization name (PTAs are usually named after the district, not the school).

STEP 2: Hunt for the Facebook page, running searches in this priority order until one hits:
1. "[district or organization name] PTA" Facebook
2. "[school name] PTA" OR "[school name] PTO" Facebook
3. "[school name]" official Facebook page
4. "[district name]" official Facebook page

Rules: a PTA/PTO page beats a school page beats a district page, because fundraising lives on PTA pages. Numbered URLs like facebook.com/p/Some-Name-12345/ are valid and very common for PTA pages; do not skip them. Do not settle for teachers'-union, alumni, or fan pages.

Respond with ONLY the single best URL (must contain facebook.com) or the word NONE. No other text.`,
        },
      ],
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 } as any],
    });
    const text = res.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join(" ");
    const matches = text.match(/https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>)\]]+/gi) || [];
    if (!matches.length) return null;
    // Prefer a URL that looks like a PTA/PTO page if several appear.
    const cleaned = matches.map((m) => m.replace(/[.,;]+$/, ""));
    const pta = cleaned.find((u) => /pta|pto/i.test(u));
    return pta || cleaned[0];
  } catch (e) {
    console.error("Facebook discovery failed:", e);
    return null;
  }
}

function normalizeFacebookUrl(u: string): string {
  // Facebook's newer /p/Name-<ID>/ page format stalls many scrapers.
  // facebook.com/<ID> resolves directly to the same page and scrapes reliably.
  const m = u.match(/facebook\.com\/p\/[^/]*?-(\d{8,})\/?/i);
  if (m) return `https://www.facebook.com/${m[1]}`;
  return u.split("?")[0];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Start the actor, watch it, then HARVEST THE DATASET REGARDLESS of how the
// run ended. A timed-out run's already-scraped posts are still in its dataset;
// partial results always beat none.
async function apifyScrapeWithHarvest(
  pageUrl: string,
  token: string,
  resultsLimit: number,
  maxWaitMs: number
): Promise<{ items: any[]; status: string; note?: string }> {
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR}/runs?token=${encodeURIComponent(token)}&timeout=${Math.ceil(maxWaitMs / 1000)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startUrls: [{ url: pageUrl }], resultsLimit }),
    }
  );
  if (!startRes.ok) {
    const t = await startRes.text().catch(() => "");
    return { items: [], status: "START_FAILED", note: `Apify start ${startRes.status}: ${t.slice(0, 150)}` };
  }
  const runId = (await startRes.json())?.data?.id;
  if (!runId) return { items: [], status: "START_FAILED", note: "Apify did not return a run id" };

  const t0 = Date.now();
  let status = "RUNNING";
  while (Date.now() - t0 < maxWaitMs) {
    await sleep(5000);
    try {
      const st = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(token)}`);
      status = (await st.json())?.data?.status || status;
      if (["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"].includes(status)) break;
    } catch { /* transient poll failure: keep waiting */ }
  }
  if (status === "RUNNING" || status === "READY") {
    // Our clock ran out first: abort so it stops billing, then harvest.
    try {
      await fetch(`https://api.apify.com/v2/actor-runs/${runId}/abort?token=${encodeURIComponent(token)}`, { method: "POST" });
      status = "ABORTED_BY_US";
    } catch { /* ignore */ }
  }

  try {
    const itemsRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${encodeURIComponent(token)}&clean=true&format=json`
    );
    const items: any[] = itemsRes.ok ? await itemsRes.json() : [];
    return { items: Array.isArray(items) ? items : [], status };
  } catch (e: any) {
    return { items: [], status, note: e?.message || "dataset fetch failed" };
  }
}

export async function scrapeFacebookPosts(pageUrl: string): Promise<SocialResult> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return { ok: false, note: "Social deep dive is not configured (missing APIFY_TOKEN)." };
  }

  const normalizedUrl = normalizeFacebookUrl(pageUrl);
  const harvest = await apifyScrapeWithHarvest(normalizedUrl, token, POSTS_FETCH_LIMIT, 150000);

  if (!harvest.items.length) {
    console.error(`Apify harvest empty (status ${harvest.status})${harvest.note ? ": " + harvest.note : ""}`);
    return {
      ok: false,
      pageUrl: normalizedUrl,
      note: `Social scrape returned no posts (run status: ${harvest.status}). The page may block scraping or have no public posts.`,
    };
  }

  const partial = harvest.status !== "SUCCEEDED";
  if (partial) {
    console.warn(`Apify run ${harvest.status}; harvested ${harvest.items.length} partial posts anyway.`);
  }
  const items = harvest.items;
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

  if (!posts.length) {
    return { ok: false, pageUrl: normalizedUrl, note: "Posts were returned but contained no readable text." };
  }
  const out: SocialResult = { ok: true, pageUrl: normalizedUrl, posts };
  (out as any).partial = partial;
  (out as any).postCount = posts.length;
  return out;
}

export function renderSocialContext(result: SocialResult | null): string {
  if (!result) return "";
  if (!result.ok) {
    return `SOCIAL DIVE STATUS: requested but FAILED (${result.note || "unknown reason"})${result.pageUrl ? `, target page was ${result.pageUrl}` : ""}. Echo this status in the social_dive field of your output. Do NOT invent social media content. Note the school's social links in the brief so the franchisee can check manually.`;
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
  const retriedNote = (result as any).partial ? " (the scrape ran out of time partway, so these are partial results; coverage of older posts may be incomplete)" : "";
  return `SOCIAL DIVE STATUS: ran successfully against ${result.pageUrl}, ${(result.posts || []).length} posts retrieved${retriedNote}. Echo this status in the social_dive field of your output.

SOCIAL MEDIA (Facebook posts, fetched for you from ${result.pageUrl}):
Treat these as primary, dated source material and cite the page as a deep-read source.
FUNDRAISER SIGNALS ARE THE PRIORITY: posts mentioning fundraisers, donations, amounts raised, goals, and what the money bought are listed first below. Amounts the school raised with their own fundraisers are VALUABLE INTEL: capture them with their year in the money trail, the angle, and the bank. (The only money restriction is unchanged and applies to emails: no specific dollar figures or multipliers about what schools raise with Apex; approved phrases only. Keep specific dollar figures out of the email drafts.)

${lines.join("\n")}`;
}
