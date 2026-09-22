# Apex School Research Agent

Version 3.9.0. An upgrade to the supplied v38 application.

The agent helps an owner decide what to ask a school and which message may fit. It researches school and parent organization sources, produces dated evidence, develops needs and JTBD hypotheses, and drafts outreach when the evidence and relationship support it. It does not assign permanent personas or diagnose personality.

## Start here

1. Open `examples/sample-brief.html` for a fictional example of the new brief. It illustrates the format, not a live research result.
2. Read `docs/RESEARCH_METHOD.md` for how signals become questions and message choices.
3. Follow setup below. Your existing Google sign-in and database can be reused.
4. Run a live pilot using `docs/EVALUATION.md` before a broad franchisee rollout.

## What changed

- Follows school and PTO links to officers, committees, budgets, minutes, newsletters and fundraiser history.
- Reads HTML and text PDFs; retains source URLs, retrieval status, dates and quotations. Search snippets never count as full page reads.
- Separates historical events, current plans and undated listings. School organization finances, PTO finances and event results have separate labels.
- Develops needs hypotheses with evidence, counterevidence, another explanation, a discovery question, message direction and proof to bring.
- Adds owner inputs for relationship, elementary/middle audience and local knowledge. Apex history and unclear scope can hold outreach for clarification.
- Separately reviews factual interpretations and outreach. A quotation match is labeled differently from a reviewed claim.
- Fixes Facebook profile ID links, searches full post text for signals before truncation, and retains relevant prior spring posts when returned by the provider.
- Shows gaps and failed or skipped checks. Exports a complete HTML brief.
- Keeps legacy briefs readable. No manual migration is needed for the new JSON format.

## Setup

Use Node.js 20.19 or newer with npm. Keep the extracted project folder together.

```bash
npm ci
cp .env.example .env.local
```

Set these server variables in `.env.local`:

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Required for research, review and drafting |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Existing Google OAuth app |
| `NEXTAUTH_SECRET` | Session secret; generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` locally; deployed URL in production |
| `ALLOWED_EMAILS` and/or `ALLOWED_DOMAIN` | Comma-separated emails and/or one domain; without either, sign-in is denied |
| `ADMIN_EMAILS` | Optional comma-separated administrators |
| `POSTGRES_URL` and provider-specific `POSTGRES_*` values | Saved history and admin reporting |
| `SERPER_API_KEY` | Optional Google discovery; otherwise uses Anthropic web search |
| `APIFY_TOKEN` | Optional public Facebook reading when selected |
| `RESEARCH_MODEL`, `VERIFY_MODEL` | Optional model overrides supported by your account |

Remove unused placeholder values. A fake optional key causes a provider call and failure; leave unused variables blank.

Configure Google's authorized redirect URI as `http://localhost:3000/api/auth/callback/google` locally and `https://YOUR-HOST/api/auth/callback/google` in production. Keep the callback and `NEXTAUTH_URL` aligned.

```bash
npm test
npm run typecheck
npm run dev
```

Open `http://localhost:3000` and sign in with an allowed Google account.

The existing `research_requests` table stores the new brief in `brief_data` and the internal evidence record in `dossier`. The app creates/adds required columns on first database use. The database user needs schema privileges. `npm run db:init` can initialize a new database and indexes. If saving fails, the brief appears with a download reminder but is not saved to history.

PostHog is optional. Set its public project key and host only if used. Existing analytics behavior is retained.

## Deploying the upgrade

This package is source code, not an already deployed service. Replace your application's source in your normal repository/deployment workflow. Keep secrets in your hosting environment.

```bash
npm ci
npm run build
npm start
```

On Vercel, use the existing Next.js project and the environment variables above. The research route requests a **600-second function duration**, with a 540-second internal research budget. Check that your hosting plan and proxy support that duration; platform limits override the code. No particular plan, cost or quota is assumed. The separate quick meetings route has a 120-second duration.

Keep the existing database. New and old brief formats use their corresponding renderers. Check a saved legacy brief in staging.

## Limits and operation

Runs are bounded: at most 28 direct page reads, two linked hops, 6 MB per document, selected passages for analysis, and optional Facebook research on at most two page URLs. No useful need or a held draft is a valid outcome.

The agent cannot access private groups, bypass blocked sites, OCR image-only PDFs, or guarantee a complete social archive. It does not access CRM. Relationship comes from the owner; public Apex history triggers a check. Owner notes are sent to the model and retained in the dossier when saving succeeds. Enter school business context appropriate for those services.

The quick PTA meeting check is a separate legacy workflow and does not inherit the full evidence-review pipeline. Confirm meeting details before attending. DISC and SOCIAL STYLE are not inferred from online profiles.

Costs vary with source volume, models, search and social calls. Review actual provider usage in the pilot. This version does not calculate a per-run bill.

## Main files

| File | Responsibility |
| --- | --- |
| `lib/research/discover.ts` | Search trails and source leads |
| `lib/research/network.ts` | Public URL validation, pinned DNS, bounded requests |
| `lib/research/reader.ts` | Linked pages, HTML/PDF extraction, passage selection |
| `lib/research/social.ts` | Facebook collection and signal selection |
| `lib/research/prompts.ts` | Evidence rules, JTBD/needs, Apex program scope |
| `lib/research/validate.ts` | Receipts, dates, confidence and outreach gates |
| `lib/research/pipeline.ts` | Research, reviews, failures and brief assembly |
| `components/EvidenceBrief.tsx` | New brief and HTML export |
| `components/BriefRenderer.tsx` | New/legacy routing |
| `tests/` | Offline regression checks; no paid API calls |

## Validation status

Local regression tests, TypeScript checks and a production build passed. Tests use synthetic schools and mocked model/provider responses, plus actual text-PDF extraction. They do not establish live research accuracy or verify credentials, Google login, production database, paid providers or hosting. Use the pilot scorecard before rollout.
