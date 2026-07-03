import { sql } from "@vercel/postgres";

// Self-healing schema: creates the table on first use and adds any columns
// introduced after the table was originally created (schema drift protection).
let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS research_requests (
          id SERIAL PRIMARY KEY,
          user_email TEXT NOT NULL,
          user_name TEXT,
          school_name TEXT NOT NULL,
          school_location TEXT NOT NULL,
          franchisee_name TEXT,
          brief_data JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`ALTER TABLE research_requests ADD COLUMN IF NOT EXISTS user_name TEXT`;
      await sql`ALTER TABLE research_requests ADD COLUMN IF NOT EXISTS franchisee_name TEXT`;
      await sql`ALTER TABLE research_requests ADD COLUMN IF NOT EXISTS brief_data JSONB`;
    })().catch((e) => {
      schemaReady = null; // allow retry on next call
      throw e;
    });
  }
  return schemaReady;
}

export interface ResearchRequest {
  id: number;
  user_email: string;
  user_name: string | null;
  school_name: string;
  school_location: string;
  franchisee_name: string | null;
  brief_data: any;
  created_at: string;
}

export async function logResearchRequest(params: {
  userEmail: string;
  userName: string | null;
  schoolName: string;
  schoolLocation: string;
  franchiseeName: string | null;
  briefData: any;
}): Promise<number> {
  await ensureSchema();
  const result = await sql`
    INSERT INTO research_requests (
      user_email, user_name, school_name, school_location, franchisee_name, brief_data
    ) VALUES (
      ${params.userEmail},
      ${params.userName},
      ${params.schoolName},
      ${params.schoolLocation},
      ${params.franchiseeName},
      ${JSON.stringify(params.briefData)}
    )
    RETURNING id
  `;
  return result.rows[0].id;
}

export async function getUserHistory(
  userEmail: string,
  limit: number = 50
): Promise<ResearchRequest[]> {
  await ensureSchema();
  const result = await sql<ResearchRequest>`
    SELECT id, user_email, user_name, school_name, school_location,
           franchisee_name, brief_data, created_at
    FROM research_requests
    WHERE user_email = ${userEmail}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return result.rows;
}

export async function getBriefById(
  id: number,
  userEmail: string
): Promise<ResearchRequest | null> {
  await ensureSchema();
  const result = await sql<ResearchRequest>`
    SELECT id, user_email, user_name, school_name, school_location,
           franchisee_name, brief_data, created_at
    FROM research_requests
    WHERE id = ${id} AND user_email = ${userEmail}
    LIMIT 1
  `;
  return result.rows[0] || null;
}

export async function getAdminBriefById(id: number): Promise<ResearchRequest | null> {
  await ensureSchema();
  // Admin can view any brief
  const result = await sql<ResearchRequest>`
    SELECT id, user_email, user_name, school_name, school_location,
           franchisee_name, brief_data, created_at
    FROM research_requests
    WHERE id = ${id}
    LIMIT 1
  `;
  return result.rows[0] || null;
}

export async function getAllRequests(limit: number = 200): Promise<ResearchRequest[]> {
  await ensureSchema();
  const result = await sql<ResearchRequest>`
    SELECT id, user_email, user_name, school_name, school_location,
           franchisee_name, brief_data, created_at
    FROM research_requests
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return result.rows;
}

export async function getUsageStats(): Promise<{
  total_requests: number;
  unique_users: number;
  requests_this_month: number;
  top_users: { user_email: string; user_name: string | null; count: number }[];
}> {
  await ensureSchema();
  const totalResult = await sql`SELECT COUNT(*) as count FROM research_requests`;
  const usersResult = await sql`SELECT COUNT(DISTINCT user_email) as count FROM research_requests`;
  const monthResult = await sql`
    SELECT COUNT(*) as count FROM research_requests
    WHERE created_at >= date_trunc('month', NOW())
  `;
  const topResult = await sql`
    SELECT user_email, user_name, COUNT(*) as count
    FROM research_requests
    GROUP BY user_email, user_name
    ORDER BY count DESC
    LIMIT 10
  `;

  return {
    total_requests: parseInt(totalResult.rows[0].count),
    unique_users: parseInt(usersResult.rows[0].count),
    requests_this_month: parseInt(monthResult.rows[0].count),
    top_users: topResult.rows.map((r) => ({
      user_email: r.user_email,
      user_name: r.user_name,
      count: parseInt(r.count),
    })),
  };
}
