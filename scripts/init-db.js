// Run with: node scripts/init-db.js
// Requires POSTGRES_URL in .env.local (or environment)

const { sql } = require("@vercel/postgres");
require("dotenv").config({ path: ".env.local" });

async function main() {
  console.log("Creating research_requests table…");

  await sql`
    CREATE TABLE IF NOT EXISTS research_requests (
      id SERIAL PRIMARY KEY,
      user_email TEXT NOT NULL,
      user_name TEXT,
      school_name TEXT NOT NULL,
      school_location TEXT NOT NULL,
      franchisee_name TEXT,
      brief_data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  console.log("Creating indexes…");
  await sql`CREATE INDEX IF NOT EXISTS idx_research_user ON research_requests(user_email)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_research_created ON research_requests(created_at DESC)`;

  console.log("Done. Database is ready.");
  process.exit(0);
}

main().catch(err => {
  console.error("DB init failed:", err);
  process.exit(1);
});
