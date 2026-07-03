"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Masthead } from "@/components/Masthead";

interface HistoryItem {
  id: number;
  school_name: string;
  school_location: string;
  franchisee_name: string | null;
  created_at: string;
}

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adminEmails, setAdminEmails] = useState<string[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signin");
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/history")
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(d => setHistory(d.history || []))
      .catch(() => setError("Failed to load history."))
      .finally(() => setLoading(false));

    // Check admin status
    fetch("/api/admin")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && session?.user?.email) {
          setAdminEmails([session.user.email.toLowerCase()]);
        }
      })
      .catch(() => {});
  }, [status, session]);

  if (status === "loading" || !session) return null;

  return (
    <div className="frame">
      <Masthead adminEmails={adminEmails} />

      <section style={{ marginBottom: 56 }}>
        <div className="hero-kicker">Your Research Archive</div>
        <h1 style={{ fontSize: "clamp(40px, 5vw, 64px)" }}>
          Past <span className="italic">Briefs</span>.
        </h1>
      </section>

      {loading && <div className="empty-state">Loading your past briefs…</div>}

      {error && <div className="error active">{error}</div>}

      {!loading && !error && history.length === 0 && (
        <div className="empty-state">
          You haven&apos;t researched any schools yet. <Link href="/" style={{ color: "#B84A0F", fontWeight: 600 }}>Start your first brief →</Link>
        </div>
      )}

      {!loading && history.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>School</th>
              <th>Location</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {history.map(h => (
              <tr key={h.id}>
                <td><strong>{h.school_name}</strong></td>
                <td>{h.school_location}</td>
                <td>{new Date(h.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</td>
                <td><Link href={`/brief/${h.id}`}>View brief →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
