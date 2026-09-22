# Validation and pilot scorecard

## Local checks

Run `npm test`, `npm run typecheck`, and `npm run build`.

The suite covers public URLs; Facebook identity links; linked officers and footer removal; text-PDF extraction; details beyond the old read cutoff; prior-spring and long posts; explicit dates; historical Apex events; invalid receipts/campus matches; tentative volunteer needs; financial labels; relationship/grade gating; gaps; prompt allocation; reviewer failure; draft review; and safe brief rendering.

Pipeline provider responses are mocked. Schools, people and the test PDF are fictional. Passing tests establishes implementation behavior, not live research accuracy.

## Live pilot

Select about 12 schools across several territories. Include elementary, middle and mixed campuses; current, former and unknown relationships; well-documented and sparse PTO sites; social pages; and strong/weak volunteer capacity. Include Charlotte Lab to revisit the earlier errors.

Have an owner and second reviewer compare each brief with actual pages and local knowledge. Record a source and correction for errors. Do not score quality by fact count or polished emails alone.

| Check | Record | Suggested acceptance rule |
| --- | --- | --- |
| School identity | Correct / wrong / unresolved | No wrong-campus actionable facts |
| Traceability | Claims with original receipts / claims reviewed | Every school-specific outreach claim has usable support |
| Dates and tenure | Current / historical / unknown; corrections | No old event or undated officer presented as confirmed current |
| Finance | Entity and goal/gross/net/expense | No material scope/amount errors |
| Missed signals | Owner-known important clues missed | Locate discovery, access or interpretation failure |
| Needs relevance | Useful / generic / misleading and why | Useful hypotheses/questions; appropriate unknown outcomes |
| Counterevidence | Present / absent / missed | Material contrary evidence changes recommendation |
| Relationship/scope | Appropriate / held / incorrect | No inappropriate cold pitch or program assumption |
| Draft accuracy | Unsupported claims/promises | Zero material unsupported claims before sending |
| Practical value | Message/question changed? Minutes saved? | Owner can name the improved decision |
| Operations | Duration, actual cost, skipped stages | Fits real hosting and research budget |

Wrong-campus outreach, invented current events, materially wrong finances or unsupported promises should block expansion pending investigation. This is a proposed gate, not a measured result.

## Charlotte Lab recheck

Re-open sources during the pilot; content changes. Earlier audit trails included PTSO volunteering/officers, Lab PTSO overview, October 2025 events and fall 2025 news on `charlottelabschool.org`.

Check linked officer discovery, school versus PTSO finances, correct Apex event years, no exhaustive annual fundraiser total, and held cold outreach until relationship and audience are clarified. These are validation questions, not preloaded conclusions.

## Not live-validated

Anthropic, Serper, Apify, Google OAuth, your database permissions/history, hosting duration, social coverage and cross-territory quality. No paid research calls were made for the offline suite. Complete these checks in your configured staging deployment.
