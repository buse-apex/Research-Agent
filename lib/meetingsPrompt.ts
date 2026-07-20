// Prompt for the PTA meetings quick check: a narrow, fast search that ONLY
// hunts for upcoming PTA/PTO meetings. Verification discipline adapted from a
// field-tested franchisee workflow: explicit dates only, source required,
// meeting types labeled, conferences and fundraisers excluded, and anything
// incomplete surfaced as needs-verification instead of guessed.

const WINDOW_DAYS = 60;

export function buildMeetingsPrompt(params: {
  schoolName: string;
  location: string;
  extraUrls?: string[];
}): string {
  const { schoolName, location, extraUrls } = params;
  const now = new Date();
  const today = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const windowEnd = new Date(now.getTime() + WINDOW_DAYS * 86400000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `Today's date is ${today}. You are finding upcoming PTA/PTO meetings for ONE school so a local fundraising partner can attend and introduce themselves. Search efficiently: this is a quick check, not a deep research project.

SCHOOL: ${schoolName}
LOCATION: ${location}
WINDOW: today through ${windowEnd} (${WINDOW_DAYS} days). Ignore anything outside this window. Ignore past meetings.
${extraUrls && extraUrls.length ? `\nCHECK THESE PAGES FIRST (provided by the user): ${extraUrls.join(", ")}\n` : ""}
WHERE TO LOOK (in order):
1. The school's own website: calendar, events, or PTA/PTO pages
2. The PTA/PTO's own website if separate
3. The school's or PTA's Facebook page (meeting announcements often only appear here; search for it)
4. District calendars mentioning this school

WHAT COUNTS AS A MEETING:
- PTA/PTO General Membership Meeting (open to all parents): include, type "General"
- PTA/PTO Board Meeting (leadership only): include, type "Board" (attendees usually need an invitation; the label matters)
DO NOT INCLUDE: parent-teacher conferences, fundraising events, spirit nights, fairs, assemblies, program deadlines. These are not PTA meetings.

VERIFICATION RULES (strict):
- "confirmed" status requires ALL of: an explicit calendar date (a stated recurring rule like "second Tuesday of each month" counts ONLY if you convert it to the actual next date and say so in notes), a stated start time, and a source URL from the school, PTA, or their official social page.
- Anything missing a piece (no time, undated "monthly meetings" language, a stale page from a prior school year) is "needs_verification" with a note saying exactly what to confirm and where.
- NEVER invent dates, times, or locations. NEVER extrapolate a recurring pattern from a single past date.
- Prefer current school year sources. A meeting schedule from a previous school year is "needs_verification" at best.
- It is normal for schools to have nothing posted (especially over summer). Say so honestly rather than stretching.

Return ONLY valid JSON (no markdown fences, no preamble):

{
  "school": "${schoolName}",
  "checked_on": "${today}",
  "meetings": [
    {
      "type": "General" or "Board",
      "org": "PTA" or "PTO" (whichever this school actually has),
      "date": "e.g. Tuesday, September 8, 2026",
      "time": "e.g. 6:00 PM" or "" if unknown,
      "location": "room/place or virtual link if stated, else ''",
      "status": "confirmed" or "needs_verification",
      "source_url": "where you found it",
      "notes": "anything the franchisee should double-check, or '' "
    }
  ],
  "none_found": false,
  "none_found_note": "If meetings is empty: one honest sentence about what you checked and why nothing turned up (e.g. PTA calendar not yet posted for the new school year).",
  "where_to_watch": ["1-3 URLs where this school's meetings get announced, so the franchisee can check closer to the date"]
}

No em dashes anywhere. Output only the JSON object.`;
}
