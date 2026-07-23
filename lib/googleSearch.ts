// Real Google results via Serper (google.serper.dev).
// The Anthropic web_search tool uses a different search index than Google;
// franchisees compare briefs against what THEY see on Google, so the tool
// needs Google's eyes too. This layer is deterministic (always runs when the
// key is set) and degrades gracefully (skips silently when it is not).

const SERPER_TIMEOUT_MS = 8000;
const MAX_RESULTS_PER_QUERY = 6;

interface GoogleHit {
  title: string;
  link: string;
  snippet: string;
}

async function serperSearch(query: string, apiKey: string): Promise<GoogleHit[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERPER_TIMEOUT_MS);
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      signal: controller.signal,
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 10 }),
    });
    if (!res.ok) {
      console.error(`Serper ${res.status} for query: ${query}`);
      return [];
    }
    const data = await res.json();
    const organic: any[] = data?.organic || [];
    return organic.slice(0, MAX_RESULTS_PER_QUERY).map((r) => ({
      title: String(r.title || ""),
      link: String(r.link || ""),
      snippet: String(r.snippet || ""),
    }));
  } catch (e: any) {
    console.error(`Serper failed for "${query}":`, e?.message || e);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// Runs the franchisee's-eye-view Google queries and renders the results as a
// context block for the researcher. Empty string when the key is missing or
// nothing comes back.
export async function googleFundraiserResults(
  schoolName: string,
  location: string
): Promise<string> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return "";

  // Query set specified by Apex: quoted school name + location across the
  // fundraising vocabulary, plus site-restricted probes of vendor platforms.
  // A hit on a vendor's own domain is proof-level evidence.
  const generalQueries = [
    `"${schoolName}" ${location} fundraiser`,
    `"${schoolName}" ${location} PTO`,
    `"${schoolName}" ${location} fun run`,
    `"${schoolName}" ${location} Booster`,
    `"${schoolName}" ${location} donations`,
  ];
  const vendorSiteQueries = [
    `site:mybooster.com "${schoolName}"`,
    `site:getmovinfundhub.com "${schoolName}"`,
    `site:myapexevent.com "${schoolName}"`,
    `site:facebook.com "${schoolName}" fundraiser`,
  ];
  const queries = [...generalQueries, ...vendorSiteQueries];

  try {
    const results = await Promise.all(queries.map((q) => serperSearch(q, apiKey)));
    const seen = new Set<string>();
    const lines: string[] = [];
    results.forEach((hits, i) => {
      const isVendorProbe = i >= generalQueries.length && !queries[i].includes("facebook.com");
      for (const h of hits) {
        if (!h.link || seen.has(h.link)) continue;
        seen.add(h.link);
        const tag = isVendorProbe ? "[VENDOR PLATFORM HIT: proof-level evidence] " : "";
        lines.push(`- ${tag}[query: ${queries[i]}] ${h.title} | ${h.link} | ${h.snippet}`);
      }
    });
    if (!lines.length) return "";
    return `GOOGLE SEARCH RESULTS (these are the actual Google results a franchisee would see for this school's fundraising; treat as leads, verify campus identity, follow up on anything relevant):\n${lines.join("\n")}`;
  } catch (e) {
    console.error("Google results layer failed (research proceeds without it):", e);
    return "";
  }
}
