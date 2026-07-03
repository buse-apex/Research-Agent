"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Masthead } from "@/components/Masthead";

interface AdminData {
  stats: {
    total_requests: number;
    unique_users: number;
    requests_this_month: number;
    top_users: { user_email: string; user_name: string | null; count: number }[];
  };
  requests: {
    id: number;
    user_email: string;
    user_name: string | null;
    school_name: string;
    school_location: string;
    created_at: string;
  }[];
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signin");
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/admin")
      .then(r => {
        if (r.status === 403) {
          setError("forbidden");
          return null;
        }
        return r.ok ? r.json() : Promise.reject(r);
      })
      .then(d => { if (d) setData(d); })
      .catch(() => setError("Failed to load admin data."))
      .finally(() => setLoading(false));
  }, [status]);

  if (status === "loading" || !session) return null;

  if (error === "forbidden") {
    return (
      <div className="frame">
        <Masthead />
        <div className="empty-state" style={{ marginTop: 40 }}>
          You don&apos;t have admin access. Contact the project owner if you think this is wrong.
        </div>
      </div>
    );
  }

  return (
    <div className="frame">
      <Masthead adminEmails={session.user?.email ? [session.user.email.toLowerCase()] : []} />

      <section style={{ marginBottom: 56 }}>
        <div className="hero-kicker">Internal · Usage Dashboard</div>
        <h1 style={{ fontSize: "clamp(40px, 5vw, 64px)" }}>
          Admin <span className="italic">View</span>.
        </h1>
      </section>

      {loading && <div className="empty-state">Loading…</div>}

      {error && error !== "forbidden" && <div className="error active">{error}</div>}

      {data && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Briefs</div>
              <div className="stat-value">{data.stats.total_requests}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Unique Franchisees</div>
              <div className="stat-value">{data.stats.unique_users}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">This Month</div>
              <div className="stat-value">{data.stats.requests_this_month}</div>
            </div>
          </div>

          <div className="section-header">
            <span className="section-num">01.</span>
            <h2 className="section-title">Top Users</h2>
            <span className="section-subtitle">By total briefs generated</span>
          </div>

          {data.stats.top_users.length === 0 ? (
            <div className="empty-state">No users yet.</div>
          ) : (
            <table className="data-table" style={{ marginBottom: 56 }}>
              <thead>
                <tr>
                  <th>Franchisee</th>
                  <th>Email</th>
                  <th style={{ textAlign: "right" }}>Briefs</th>
                </tr>
              </thead>
              <tbody>
                {data.stats.top_users.map((u, i) => (
                  <tr key={i}>
                    <td><strong>{u.user_name || "—"}</strong></td>
                    <td>{u.user_email}</td>
                    <td style={{ textAlign: "right" }}>{u.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="section-header">
            <span className="section-num">02.</span>
            <h2 className="section-title">Recent Requests</h2>
            <span className="section-subtitle">Latest 200</span>
          </div>

          {data.requests.length === 0 ? (
            <div className="empty-state">No requests yet.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>School</th>
                  <th>Location</th>
                  <th>Franchisee</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.requests.map(r => (
                  <tr key={r.id}>
                    <td><strong>{r.school_name}</strong></td>
                    <td>{r.school_location}</td>
                    <td>{r.user_name || r.user_email}</td>
                    <td>{new Date(r.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</td>
                    <td><Link href={`/brief/${r.id}`}>View →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
