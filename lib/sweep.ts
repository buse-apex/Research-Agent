// Deterministic fundraising sweep.
// The main research call has a long instruction list and a fixed search budget,
// so platform/990 hunts left to its discretion sometimes get triaged away.
// This small dedicated call ALWAYS runs exactly these hunts and hands the
// findings to the research as pre-gathered leads. Code-guaranteed, not
// model-discretionary.

import type Anthropic from "@anthropic-ai/sdk";

const SWEEP_MODEL = "claude-haiku-4-5"; // narrow retrieval work

export async function fundraisingSweep(
  anthropic: Anthropic,
  schoolName: string,
  location: string
): Promise<string> {
  try {
    const prompt = `You are running a narrow fundraising-footprint sweep for the school "${schoolName}" in ${location}. Run these searches (all of them):
1. "${schoolName} ${location} fundraiser"
2. "${schoolName} PTO givebutter OR classful OR gofundme OR ptboard"
3. "${schoolName} PTO 990"

From ALL results, report every fundraising-relevant finding as one line each:
URL | what it is | which school it belongs to (city/state)

Fundraising-relevant means: donation platforms (givebutter.com, classful.com, ptboard.com, zeffy.com, cheddarup.com, gofundme.com, memberhub.com, givebacks.com, 99pledges.com, snap-raise), vendor pledge pages (mybooster.com, funrun.com, getmovinfundhub.com, raisecraze.com, myapexevent.com), nonprofit/990 records (guidestar.org, projects.propublica.org, causeiq.com, philanthropy.org), a PTA/PTO's own site, or news/posts naming a fundraiser.

CRITICAL: schools in different states share names. Check each result's city/state and label any that belong to a DIFFERENT same-named school as "WRONG SCHOOL, DO NOT USE". Include revenue figures from 990 snippets when shown, with the filing year.

If nothing relevant surfaces, output exactly: NONE FOUND.
Output only the findings lines (or NONE FOUND), no commentary.`;

    let messages: any[] = [{ role: "user", content: prompt }];
    let res = await anthropic.messages.create({
      model: SWEEP_MODEL,
      max_tokens: 1500,
      messages,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 } as any],
    });
    let guard = 0;
    while ((res.stop_reason as string) === "pause_turn" && guard < 1) {
      messages = [...messages, { role: "assistant", content: res.content }];
      res = await anthropic.messages.create({
        model: SWEEP_MODEL,
        max_tokens: 1500,
        messages,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 2 } as any],
      });
      guard++;
    }
    const text = res.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();
    if (!text || /NONE FOUND/i.test(text)) return "";
    return text;
  } catch (e) {
    console.error("Fundraising sweep failed (research proceeds without it):", e);
    return "";
  }
}
