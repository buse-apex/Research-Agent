// Guaranteed fetching of franchisee-supplied URLs.
// Each URL is fetched server-side, reduced to readable text, and returned so it
// can be injected into the research prompt as must-read context. Every fetch is
// isolated: one bad URL (timeout, block, 404) never fails the others or the run.

const MAX_URLS = 5;
const FETCH_TIMEOUT_MS = 12000;
const MAX_CHARS_PER_PAGE = 6000; // keep prompt size and cost bounded

export interface FetchedPage {
  url: string;
  ok: boolean;
  text?: string;
  error?: string;
}

// Accept only well-formed http(s) URLs. Silently drop anything else.
export function sanitizeUrls(raw: unknown): string[] {
  if (!raw) return [];
  let list: string[] = [];
  if (Array.isArray(raw)) list = raw.map((x) => String(x));
  else list = String(raw).split(/[\n,]+/);

  const cleaned: string[] = [];
  for (let u of list) {
    u = u.trim();
    if (!u) continue;
    if (!/^https?:\/\//i.test(u)) u = "https://" + u; // tolerate missing scheme
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      if (!cleaned.includes(parsed.href)) cleaned.push(parsed.href);
    } catch {
      // skip malformed
    }
    if (cleaned.length >= MAX_URLS) break;
  }
  return cleaned;
}

function htmlToText(html: string): string {
  let s = html;
  // Drop script/style/noscript blocks entirely
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  // Turn block tags into line breaks so text doesn't run together
  s = s.replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>/gi, "\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  // Strip remaining tags
  s = s.replace(/<[^>]+>/g, " ");
  // Decode a few common entities
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  // Collapse whitespace
  s = s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return s;
}

async function fetchOne(url: string): Promise<FetchedPage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // A normal-looking UA reduces trivial bot blocks; not a guarantee.
        "User-Agent":
          "Mozilla/5.0 (compatible; ApexResearchAgent/1.0; +https://apexleadershipco.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) {
      return { url, ok: false, error: `HTTP ${res.status}` };
    }
    const ctype = res.headers.get("content-type") || "";
    if (!/text\/html|text\/plain|application\/xhtml/i.test(ctype)) {
      return { url, ok: false, error: `Unsupported content type (${ctype || "unknown"})` };
    }
    const raw = await res.text();
    const text = htmlToText(raw).slice(0, MAX_CHARS_PER_PAGE);
    if (!text) return { url, ok: false, error: "No readable text found" };
    return { url, ok: true, text };
  } catch (e: any) {
    const msg = e?.name === "AbortError" ? "Timed out" : e?.message || "Fetch failed";
    return { url, ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchUrls(urls: string[]): Promise<FetchedPage[]> {
  if (!urls.length) return [];
  return Promise.all(urls.map(fetchOne));
}

// Render fetched pages into a prompt block. Includes failures so the model knows
// a requested page could not be read (and should not invent its contents).
export function renderFetchedContext(pages: FetchedPage[]): string {
  if (!pages.length) return "";
  const blocks = pages.map((p) => {
    if (p.ok) {
      return `SOURCE (franchisee-provided, guaranteed read): ${p.url}\n${p.text}`;
    }
    return `SOURCE (franchisee-provided) COULD NOT BE READ: ${p.url}\nReason: ${p.error}. Do not invent this page's contents; try to find the same information through your own search instead.`;
  });
  return blocks.join("\n\n----\n\n");
}
