// Server-side link validation. Search engines index stale URLs (schools
// migrate website platforms and old paths die), and the model faithfully
// cites what search returned. Rather than let a franchisee click a 404 in
// front of their prep work, we verify every link before the brief renders
// and mark the confirmed-dead ones.
//
// Deliberately conservative: ONLY a definitive 404/410 marks a link dead.
// Bot-blocks (403), rate limits (429), server hiccups (5xx), and timeouts
// keep the link, because those pages often work fine in a human browser.

const CHECK_TIMEOUT_MS = 6000;
const MAX_LINKS = 40;

async function checkOne(url: string): Promise<boolean /* dead */> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    let res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ApexResearchAgent/1.0)" },
    });
    // Some servers reject HEAD outright; retry those as GET.
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ApexResearchAgent/1.0)" },
      });
    }
    return res.status === 404 || res.status === 410;
  } catch {
    return false; // network trouble is not proof of death
  } finally {
    clearTimeout(timer);
  }
}

// Mutates the parsed brief in place: sources gain `dead`, bank items whose
// source link is dead get `source_dead` (the fact and its status remain).
export async function markDeadLinks(parsed: any): Promise<void> {
  try {
    const targets: { url: string; mark: (dead: boolean) => void }[] = [];

    for (const s of parsed?.sources || []) {
      if (s?.url) targets.push({ url: s.url, mark: (d) => { if (d) s.dead = true; } });
    }
    const bank = parsed?.personalization_bank || {};
    for (const key of ["named_people", "money_trail", "recent_moments", "their_words", "calendar_timing", "social_links"]) {
      for (const item of bank[key] || []) {
        if (item && typeof item === "object" && item.source) {
          targets.push({ url: item.source, mark: (d) => { if (d) item.source_dead = true; } });
        }
      }
    }

    // De-duplicate so each URL is checked once regardless of how often it's cited.
    const byUrl = new Map<string, ((dead: boolean) => void)[]>();
    for (const t of targets.slice(0, MAX_LINKS)) {
      const list = byUrl.get(t.url) || [];
      list.push(t.mark);
      byUrl.set(t.url, list);
    }

    await Promise.all(
      Array.from(byUrl.entries()).map(async ([url, marks]) => {
        const dead = await checkOne(url);
        for (const mark of marks) mark(dead);
      })
    );
  } catch (e) {
    console.error("Link check failed (brief proceeds unmarked):", e);
  }
}
