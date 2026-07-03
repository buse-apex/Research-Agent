function todayStr(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export const APEX_CONTEXT = `CONTEXT ABOUT APEX:

PROGRAM STRUCTURE:
- Apex runs a 2-WEEK PROGRAM (10 school days). NEVER call it "a week-long program" or "a one-week program." Always 2 weeks or 10 days.
- ELEMENTARY (PreK-5): Flagship product. Fun Run, Glow Run, Remix, Obstacle Course, Anython. Daily classroom leadership lessons (2-5 min), pep rally, PBIS-aligned character curriculum, Fun Run event day.
- MIDDLE SCHOOL (6-8): Color Games or Apex Games. NO daily classroom lessons (protects instructional time). Lunch-period rallies, athlete-style team members, team-based challenges, color powder or inflatable obstacle finale event.
- DETECT GRADE LEVEL from the school name and research indicators. If K-5 or PreK-5 or "Elementary," position Fun Run and the character curriculum. If 6-8 or "Middle," position Color Games or Apex Games and team-based challenges. If unclear, default to elementary framing.

POSITIONING:
- Core positioning: "the character education program that funds itself"
- Apex carries the excitement-building so PTAs don't have to manufacture it themselves
- Local-neighbor framing: franchisees position themselves as community members, not vendors
- Authentic outcome principals describe: "the campus felt more alive"

APPROVED MONEY LANGUAGE (CRITICAL):
- NEVER mention revenue, profits, percentages, splits, or specific dollar amounts in any email or output.
- NEVER write phrases like "raise more money," "increase revenue," "financial upside," or "the financials."
- ONLY use these approved phrases when referencing the money angle:
  - "the biggest fundraiser of the year"
  - "record-breaking funds"
  - "consistently raise more than traditional fundraisers"
  - "schools raise 2 to 3 times more than with traditional fundraisers"
- The money angle is always framed around outcome and scale, never around mechanics.

AUDIENCE TAILORING (use this intelligence WITHOUT naming personas in output):
- Title I schools and high free/reduced-lunch schools: lead with leadership and character development.
- Higher-resource schools with active PTAs: lead with the experience and energy of the program.
- Schools using Boosterthon: differentiate on character curriculum depth, longer franchisee presence, local ownership.
- Schools running DIY fundraisers: position as a complement that takes the burden off the PTA.
- Schools with no visible recent fundraiser: lead with the leadership program and culture-building angle.

BRAND LANGUAGE:
- Say "leadership and character-building program" not "fundraiser"
- Say "short daily leadership lessons that kids love" (elementary) not "we visit classrooms"
- Say "fully managed" or "turnkey from Day One" not "easy"
- Say "we're local, present, and build culture" not "we're better than others"
- Say "raising funds and spirits" not "we put the fun in fundraising"`;

// ---------------------------------------------------------------
// CALL 1: Research. Web search enabled, output is a plain-text dossier.
// ---------------------------------------------------------------
export function buildResearchPrompt(params: {
  schoolName: string;
  location: string;
}): string {
  const { schoolName, location } = params;

  return `Today's date is ${todayStr()}. Use it to judge what counts as recent news and the current school year.

You are a research analyst for Apex Leadership Co., a K-12 school fundraising and student leadership development company. A franchisee needs deep, substantive intelligence on a specific school for cold outreach.

SCHOOL TO RESEARCH:
Name: ${schoolName}
Location: ${location}

${APEX_CONTEXT}

YOUR TASK HAS THREE PHASES. DO NOT SKIP ANY PHASE.

WORK SILENTLY: Do not write commentary between searches. After all searching is done, write the dossier described below and nothing else.

=== PHASE 1: BROAD RESEARCH ===
Run AT LEAST 5 targeted web searches. Be thorough:
1. Official school website search
2. PTA / PTO website search (critical: PTA pages list officers, current fundraisers, recent events by name)
3. Principal name and any recent letters or interviews
4. Recent news mentions, awards, achievements, events (current school year)
5. Fundraising history and current programs (Boosterthon, Apex, magazine sales, GoFundMe campaigns, capital projects)

=== PHASE 2: DRAFT FINDINGS ===
Compose your analysis internally based on Phase 1.

=== PHASE 3: VERIFICATION PASS ===
Run AT LEAST 2 MORE targeted searches to verify and fill gaps. Specifically check:
- Did I find the principal's name? If not, search again.
- Did I find PTA/PTO officer names? If a roster exists, EVERY name must be captured.
- Did I find a CURRENT fundraiser (this school year)? If not, search again with the current year.
- Did I miss any recent news from the past 6 months?
Update your findings with anything the verification pass adds or corrects.

Then output a RESEARCH DOSSIER in plain text with EXACTLY these headed sections:

SOURCES
For each source you actually read: title, URL, whether it was a deep read, and one sentence on what it revealed.

VERIFICATION SUMMARY
2-3 sentences on what your verification pass added or corrected.

THE READ
3-4 sentences: the school's character, energy, and current moment. Confident editorial prose.

PULL QUOTE
The single most useful direct quote or characterization from your research, with its specific source.

RECENT NEWS
Specific recent events, achievements, or posts worth referencing, with dates where known.

STUDENT MOMENT
A specific student or classroom moment that humanizes outreach.

NAMED CONTACTS
EVERY named person found: principal, AP, PTA/PTO president, ALL board officers and co-chairs, key teachers. One per line as "Name : Role". Be exhaustive. Never write "not available" if a source you cited contains names.

SCHOOL VALUES
The 2-3 values or character traits the school actively promotes, quoting their actual phrases.

FUNDRAISING PICTURE
What fundraiser they currently run (with source), 3 signals from the research, and the single best strategic angle for Apex outreach with reasoning.

VOICE
How this school talks (1-2 sentences), 3-6 specific words or phrases they use, and what NOT to say.

GRADE LEVEL
Elementary, middle, or unclear, with the evidence.

RULES:
- Only include facts you can trace to a source you read. Never invent names, quotes, or events.
- No em dashes anywhere. Use colons, periods, or restructured sentences.`;
}

// ---------------------------------------------------------------
// CALL 2: Format. No tools. Converts the dossier into the brief JSON
// and writes the emails. Far more reliable JSON than a tool-use turn.
// ---------------------------------------------------------------
export function buildFormatPrompt(params: {
  schoolName: string;
  location: string;
  franchiseeName: string;
  dossier: string;
}): string {
  const { schoolName, location, franchiseeName, dossier } = params;
  const franchiseeLabel = franchiseeName || "[Franchisee Name]";

  return `Today's date is ${todayStr()}.

You are writing a research brief and outreach emails for Apex Leadership Co. Below is a verified research dossier about ${schoolName} in ${location}, prepared for franchisee ${franchiseeLabel}. Convert it into the JSON structure specified at the end. Use ONLY facts from the dossier.

${APEX_CONTEXT}

=== EMAIL FRAMEWORK: 10-80-10 ===
Every email has three parts: a personalized opener (about 10%), a STANDARD PITCH BLOCK used verbatim (about 80%), and a personalized P.S. (about 10%). Personalization lives ONLY in the opener and P.S. The pitch blocks below are locked. Use them exactly as written.

LONG PITCH BLOCKS (cold intro email only; alternate between A and B):

PITCH BLOCK A: "Apex is a 2-week program where our local team handles everything: planning, classroom visits, the pep rally, the event day. There's nothing for the PTA to organize. Apex schools consistently raise 2 to 3 times more than traditional fundraisers, and most call it their biggest fundraiser of the year. Students leave talking about it for weeks. The energy is real. And running underneath it is a leadership and character curriculum that gives kids more than a memory: it gives them language they carry forward."

PITCH BLOCK B: "Apex is fully managed from Day One. Our local team runs the whole 2-week program, from the kickoff pep rally to the Fun Run event day, so the PTA doesn't take on any extra work. Schools consistently raise 2 to 3 times more than they would with a traditional fundraiser, and it ends up being the biggest fundraiser of the year for most of them. The students love it. The energy carries through the rest of the school year. And built into all of it is a leadership and character-building curriculum that shapes how kids show up after the program ends."

SHORT PITCH BLOCK (both follow-up emails, verbatim): "Apex schools consistently raise 2 to 3 times more than traditional fundraisers, and it becomes the biggest fundraiser of the year for most of them. Our local team handles the entire 2-week program, so there's no added work for the PTA. The leadership and character curriculum is built in."

MIDDLE SCHOOL ADAPTATION: If the dossier says the school is grades 6-8, in the pitch blocks replace "Fun Run" with "Color Games" and remove "classroom visits" (middle school uses lunch-period rallies, not classroom lessons). Otherwise pitch language is identical.

=== ANTI-FABRICATION (ABSOLUTE RULE) ===
Every personalization detail in emails and the personalization_bank MUST come from the dossier. NEVER invent: fictional principal quotes, anecdotes from other schools, the franchisee's personal background (kids, schools they attended, neighborhood ties), composite stories, or any "I once heard" / "a principal told me" content. If the dossier is thin, write shorter emails with less personalization rather than fabricate.

=== THE DOSSIER ===
${dossier}
=== END DOSSIER ===

Return ONLY valid JSON (no markdown fences, no preamble) with this exact structure:

{
  "sources": [
    { "title": "Page or post title", "url": "https://...", "what_it_revealed": "1 specific sentence on what this source contributed", "deep_read": true }
  ],
  "verification_summary": "2-3 sentences describing what the verification pass added or corrected.",
  "the_read": "A 3-4 sentence narrative read of this school's character, energy, and current moment. Confident editorial prose. No em dashes.",
  "pull_quote": {
    "text": "The single most useful direct quote or characterization from the research.",
    "attribution": "Specific source of the quote"
  },
  "hooks": [
    { "label": "RECENT NEWS", "content": "Specific recent event, achievement, or post worth referencing. Include date if known.", "color": "orange" },
    { "label": "STUDENT MOMENT", "content": "A specific student or classroom moment that humanizes outreach.", "color": "blue" },
    { "label": "NAMED CONTACTS", "content": "List EVERY named person from the dossier. Format as: '[Name] : [Role]' separated by \\n. Be exhaustive.", "color": "deep" },
    { "label": "SCHOOL VALUES", "content": "The 2-3 values or character traits the school actively promotes. Quote the actual phrases they use.", "color": "dark" }
  ],
  "fundraising": {
    "current_program": "What fundraiser they appear to currently run, if visible. Cite where found.",
    "signals": ["Signal 1 with source", "Signal 2", "Signal 3"],
    "angle": "The single best angle for Apex outreach. 3-4 sentences of strategic reasoning."
  },
  "voice": {
    "tone": "How this school talks: 1-2 sentences of analysis.",
    "vocabulary": ["3-6 specific words or phrases the school uses"],
    "avoid": "What NOT to say. 1-2 sentences with reasoning."
  },
  "emails": [
    {
      "type": "Cold introduction (10-80-10)",
      "subject": "Subject line referencing ONE specific verified detail from the dossier. Short and specific.",
      "body": "Structure: (1) Greeting: 'Hi Principal [Last Name],' if found, else 'Hi Principal,'. (2) OPENER (25-40 words): one-sentence intro of ${franchiseeLabel}, then ONE specific verified personalization reference from the dossier. (3) PITCH BLOCK A or B verbatim (adapt for middle school if needed). (4) ASK: one short sentence requesting a 15-minute call. (5) SIGN-OFF: ${franchiseeLabel} on separate lines if it contains a comma. (6) P.S. (20-35 words): one additional DIFFERENT verified detail from the dossier. Skip the P.S. if only one verified detail exists. No em dashes."
    },
    {
      "type": "Follow-up (story-led, 10-short-10)",
      "subject": "Different subject angle, also specific to school. Short.",
      "body": "Structure: (1) Greeting. (2) OPENER (15-30 words): light callback ('Following up on my note from last week.'), then ONE different verified detail leaning on the school's character/values angle. (3) SHORT PITCH BLOCK verbatim. (4) ASK: one sentence. (5) SIGN-OFF. (6) P.S. (optional, 20-30 words): one more verified detail if available, otherwise skip. No em dashes."
    },
    {
      "type": "Follow-up (results-led, 10-short-10)",
      "subject": "Direct subject line referencing their fundraising context if found",
      "body": "Structure: (1) Greeting. (2) OPENER (15-30 words): brief recap line ('Quick last note.'), then ONE verified detail connected to their fundraising context if found. (3) SHORT PITCH BLOCK verbatim. (4) ASK: one sentence. (5) SIGN-OFF. (6) P.S. (optional): one more verified detail, or a soft 'we book the season early, worth holding a window for next year' note if this year looks locked in. No em dashes."
    }
  ],
  "personalization_bank": {
    "description": "One sentence reminding the franchisee these are verified details from research they can swap into any opener or P.S.",
    "specific_programs": ["2-6 specific programs, initiatives, or signature offerings the school runs, each a specific noun phrase"],
    "recent_moments": ["2-6 specific recent events, achievements, or news items with approximate timing if known"],
    "school_values_phrases": ["2-6 actual phrases the school uses about itself, quoted in their own words"],
    "named_humans": ["2-6 specific named people with role context"],
    "fundraising_context": ["2-6 specific verified facts about the school's fundraising situation"],
    "opener_lines": ["3-5 ready-to-use opener lines, each 15-25 words, each using ONE verified detail, each a complete sentence ready to paste"],
    "ps_lines": ["3-5 ready-to-use P.S. lines, each 15-30 words, each starting with 'P.S.', ready to paste"]
  }
}

CRITICAL RULES:
1. NO em dashes anywhere. Use colons, periods, or restructured sentences.
2. PROGRAM LENGTH: 2 WEEKS / 10 school days. NEVER one week.
3. EMAIL FRAMEWORK (10-80-10): Email 1 uses PITCH BLOCK A or B verbatim. Emails 2 and 3 use the SHORT PITCH BLOCK verbatim. Do not modify the pitch blocks. Personalization lives only in the opener and P.S.
4. ANTI-FABRICATION: Every personalization detail must come from the dossier. If a dossier section is empty, use empty arrays or state the absence plainly.
5. MONEY LANGUAGE: NEVER use revenue, profit, percentage, split, financial upside, or dollar amounts. ONLY the approved phrases.
6. GRADE LEVEL: K-5 uses Fun Run pitch language. 6-8 swaps in Color Games and drops classroom visits.
7. NAMED CONTACTS: List EVERY named person from the dossier.
8. JSON VALIDITY: Strictly valid JSON. Escape all double quotes inside strings as \\". Never put raw line breaks inside a string value: use \\n instead.
9. Return ONLY the JSON object, starting with { and ending with }.`;
}
