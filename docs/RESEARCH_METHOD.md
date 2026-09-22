# How the agent researches a school

## The decision it supports

What matters enough to this school that it could change our first message, questions or proof?

Needs-based segmentation and JTBD guide interpretation. Online research supplies clues; SPIN-compatible questions confirm or correct them. Schools may have several needs, and priorities change. This is a dated account brief, not a permanent persona.

## Research trail

1. Resolve school and parent organization from name, location and optional URLs.
2. Search official pages, officers/volunteers, budgets/minutes, giving, event history, school-day constraints and participation.
3. Follow relevant links for up to two hops, including text PDFs. Read content before using it as a fact.
4. Optionally collect public Facebook posts from up to two page URLs, selecting decision-relevant signals.
5. Extract facts with exact excerpts, source IDs, entity/campus, date and financial scope.
6. Apply receipt/date checks, then a separate model review of interpretation.
7. Develop needs, alternatives, questions and messaging directions from usable facts.
8. Check relationship and audience. Generate and separately review up to two drafts when permitted.

## Signals to investigate

| Possible need | Online sources and clues | Alternative explanation | Discovery question | Message and proof direction |
| --- | --- | --- | --- | --- |
| Reduce workload | PTO minutes, vacancies, cancelled events, repeated unfilled roles, volunteer pages | Routine recruitment; a small but capable committee | How manageable was the workload last time, and where did it fall? | Discuss responsibilities; bring a realistic work plan |
| Reach a funding goal | Budgets, giving pages, named projects, campaign deadlines | Goal already met; another organization owns the need | Is this still the priority, and what remains to be funded? | Connect to confirmed use of funds and relevant local examples |
| Make cost worthwhile | Treasurer reports, fees, gross/net proceeds, fundraiser evaluations | Lower net reflects deliberate spending or accounting differences | How do you judge return after cost and effort? | Discuss net value and tradeoffs; bring a transparent comparison |
| Build participation | Family surveys, improvement plans, stated participation goals or barriers | Inclusive language is standard policy | Who participated last time, and who would you like to reach? | Explore participation design and applicable access options |
| Protect the school day | Calendars, staff feedback, minutes about disruption/scheduling | Busy calendar but a workable process | What must a fundraiser work around during the school day? | Explain scheduling and staff expectations with an adaptable plan |

Search strings are in `lib/research/discover.ts`. Poorly indexed or blocked documents can be missed. The source register shows retrieval outcomes, not exhaustive coverage.

## Evidence rules

- **Source matched:** quotation exists in a retrieved page and passed structural checks. Interpretation is not independently confirmed.
- **Reviewed:** a separate model pass found the entire claim supported. Automated review remains fallible.
- **Unclear/contradicted:** visible but excluded from supporting needs and drafts.
- **Rejected:** wrong campus, missing source, duplicate ID, nonmatching quote or snippet-only receipt. Excluded and counted as a gap.
- **Historical:** older school-year evidence. A past Apex event does not establish a current booking.
- **Undated:** cannot confirm current tenure or a current funding gap.

An event date needs day, month and year in its passage. Footer, access and publication dates are not automatically event dates. August 1 is the application's school-year boundary; unusual local calendars may need adjustment. Explicit school years remain separate.

Financial entity and amount type stay separate: school organization / PTO / campaign; goal / gross / net / expense. Do not turn a PTO target into total school need or add overlapping amounts.

## From evidence to a useful hypothesis

Fictional observation: A PTO asks for spring-fair volunteers.

Hypothesis: The team may value help with delivery. Confidence stays tentative; routine recruitment is not workload strain.

JTBD: When planning an event, help us cover the work so we can deliver it with available volunteers.

Alternative: The team already has enough volunteers and is inviting wider participation.

Question: How manageable was the work last time?

Message: Explore workload, then explain support if it matters. Do not assert burnout.

Even direct evidence yields a **supported hypothesis**, not a confirmed customer need. Confidence rules are conservative heuristics, not a purchase probability.

## Relationship and audience

- Current customer supplied by owner: planning/support language.
- Former customer: acknowledge experience without guessing why it ended.
- Unknown/prospect plus public Apex history: hold drafts and confirm relationship.
- Mixed/high or unclear scope: hold program pitch until elementary/middle audience is specified.
- No usable school identity evidence: hold drafts.

Elementary and middle claims have separate `PROGRAM_FACTS` rules. No prices, fixed staffing, available dates, guarantees or zero-work promises are invented.

## Updating understanding

After a conversation, rerun with corrected relationship, audience and notes. Owner notes remain separate from public evidence; each saved run is dated. This release does not merge runs, maintain CRM, schedule refreshes or automatically mark needs customer-confirmed.

FRL and Title I may be sourced as context, but never stand in for buying motives, engagement or fundraising potential. DISC/SOCIAL STYLE should not be inferred from photos, titles, demographics or public posts.
