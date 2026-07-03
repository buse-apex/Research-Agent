# The Apex Brief — School Research Agent

A Next.js app for Apex franchisees: takes a school name + location, researches the school via web search, and returns a structured brief with personalization hooks, fundraising signals, and 3 ready-to-send email drafts.

## Stack

- **Next.js 14** (App Router, TypeScript)
- **NextAuth** with Google OAuth, restricted to your Apex Google Workspace domain
- **Vercel Postgres** for tracking research requests and history
- **Anthropic API** with `web_search` tool for the research itself
- Deployed on **Vercel**

## Features

- `/` — Research a school (gated by login)
- `/history` — Your past briefs
- `/brief/[id]` — View any past brief
- `/admin` — Usage stats and recent requests (admin emails only)

---

## Setup — Step by Step

### 1. Clone and install

```bash
git clone <your-repo>
cd apex-research-agent
npm install
```

### 2. Create a Google OAuth app

1. Go to https://console.cloud.google.com/apis/credentials
2. Create a new project (or use an existing one) → **OAuth 2.0 Client ID** → **Web application**
3. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (for local dev)
   - `https://YOUR-VERCEL-DOMAIN.vercel.app/api/auth/callback/google` (for production — add after deploy)
4. Copy the **Client ID** and **Client Secret**

### 3. Set up environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in:

- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
- `NEXTAUTH_URL` — `http://localhost:3000` for local
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from step 2
- `ALLOWED_EMAIL_DOMAIN` — your Apex Google Workspace domain (e.g. `apexleadershipco.com`)
- `ADMIN_EMAILS` — comma-separated admin emails (e.g. `buse@apexleadershipco.com,jamie@apexleadershipco.com`)
- `ANTHROPIC_API_KEY` — from https://console.anthropic.com

### 4. Set up Vercel Postgres

**Option A — Local dev with hosted DB (recommended):**

1. Deploy a placeholder version to Vercel first (see step 5)
2. In Vercel Dashboard → Storage → Create → Postgres
3. Connect it to your project
4. Vercel auto-injects the `POSTGRES_*` variables to production
5. For local dev: copy the values from the Postgres dashboard → `.env.local` tab → paste into your local `.env.local`

**Option B — Local Postgres:**

Run Postgres locally and set `POSTGRES_URL` to your local connection string.

### 5. Initialize the database schema

```bash
npm install dotenv  # one-time, for the init script
node scripts/init-db.js
```

This creates the `research_requests` table.

### 6. Run locally

```bash
npm run dev
```

Open http://localhost:3000 — sign in with your Apex Google account.

### 7. Deploy to Vercel

```bash
# If you have the Vercel CLI:
vercel

# Or push to a GitHub repo and import in the Vercel Dashboard
```

After deploying:
1. Add all `.env.local` variables to Vercel → Project Settings → Environment Variables
2. Update `NEXTAUTH_URL` to your production URL
3. Update Google OAuth redirect URI (step 2) to include the production URL
4. Connect Vercel Postgres (step 4) if you haven't yet
5. Trigger a redeploy

---

## File Structure

```
apex-research-agent/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts   # NextAuth handler
│   │   ├── research/route.ts              # Anthropic call + DB log
│   │   ├── history/route.ts               # User's own history
│   │   └── admin/route.ts                 # Admin stats + all requests
│   ├── admin/page.tsx                     # Admin dashboard
│   ├── brief/[id]/page.tsx                # Single brief viewer
│   ├── history/page.tsx                   # User's history list
│   ├── signin/page.tsx                    # Google sign-in
│   ├── page.tsx                           # Main research page
│   ├── layout.tsx                         # Root layout
│   ├── providers.tsx                      # SessionProvider wrapper
│   └── globals.css                        # All styling
├── components/
│   ├── Masthead.tsx                       # Top nav
│   └── BriefRenderer.tsx                  # Renders a brief
├── lib/
│   ├── auth.ts                            # NextAuth config + isAdmin helper
│   ├── db.ts                              # Postgres queries
│   └── prompt.ts                          # The Apex research prompt
├── scripts/
│   └── init-db.js                         # Creates the DB table
├── .env.example
├── next.config.js
├── package.json
└── tsconfig.json
```

---

## Updating the Apex Prompt

The research prompt lives in `lib/prompt.ts`. Edit it there. Changes deploy automatically on next push.

## Adding an Admin

Add their email to `ADMIN_EMAILS` in Vercel → Project Settings → Environment Variables, comma-separated. Redeploy.

## Cost Notes

- **NextAuth**: free
- **Vercel Postgres**: free up to 256 MB and 60 hours compute/month (well within usage)
- **Vercel hosting**: free Hobby tier covers this app
- **Anthropic API**: each research call costs roughly $0.30 to $0.60 depending on how many web searches the agent runs. With a 100-franchisee network running 5 briefs/week, that's ~$120 to $240/month.

## Security Notes

- The Anthropic API key stays server-side in environment variables. Never exposed to the browser.
- Sign-in is restricted to your Google Workspace domain by `ALLOWED_EMAIL_DOMAIN`.
- Admin routes check `ADMIN_EMAILS` on the server.
- Per-user brief access is enforced server-side: users can only fetch their own briefs (admins can fetch any).
