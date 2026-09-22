"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Masthead } from "@/components/Masthead";
import { track } from "./providers";
import { BriefRenderer } from "@/components/BriefRenderer";

const STEPS = [
  "Finding the school's Facebook and reading supplied pages",
  "Searching the web for the school",
  "Reading the school's website, live feed, and PTA pages",
  "Hunting vendor history and fundraiser signals",
  "Independent verification pass: re-checking key claims",
  "Writing emails and building the personalization bank",
];

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [schoolName, setSchoolName] = useState("");
  const [location, setLocation] = useState("");
  const [franchiseeName, setFranchiseeName] = useState("");
  const [extraUrls, setExtraUrls] = useState("");
  const [includeSocial, setIncludeSocial] = useState(false);

  // Persist form inputs across reloads/deploys so testers and franchisees
  // don't lose their setup every time the page refreshes.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("apex_research_form");
      if (saved) {
        const f = JSON.parse(saved);
        if (f.schoolName) setSchoolName(f.schoolName);
        if (f.location) setLocation(f.location);
        if (f.franchiseeName) setFranchiseeName(f.franchiseeName);
        if (f.extraUrls) setExtraUrls(f.extraUrls);
        if (typeof f.includeSocial === "boolean") setIncludeSocial(f.includeSocial);
      }
    } catch { /* never break the form over storage */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        "apex_research_form",
        JSON.stringify({ schoolName, location, franchiseeName, extraUrls, includeSocial })
      );
    } catch { /* ignore */ }
  }, [schoolName, location, franchiseeName, extraUrls, includeSocial]);
  const [meetingsData, setMeetingsData] = useState<any | null>(null);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [briefData, setBriefData] = useState<any>(null);
  const [briefInputs, setBriefInputs] = useState<{ schoolName: string; location: string; franchiseeName: string } | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const stepIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [adminEmails, setAdminEmails] = useState<string[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signin");
    }
  }, [status, router]);

  useEffect(() => {
    // Fetch admin emails for masthead nav
    fetch("/api/admin")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && session?.user?.email) {
          setAdminEmails([session.user.email.toLowerCase()]);
        }
      })
      .catch(() => {});
  }, [session]);

  // Pre-fill franchisee name from session
  useEffect(() => {
    if (session?.user?.name && !franchiseeName) {
      setFranchiseeName(session.user.name);
    }
  }, [session, franchiseeName]);

  const handleSubmit = async () => {
    setError("");

    if (!schoolName.trim()) {
      setError("Please enter the school's name.");
      return;
    }
    if (!location.trim()) {
      setError("Please add the city and state.");
      return;
    }

    setLoading(true);
    setBriefData(null);
    setStepIndex(0);

    stepIntervalRef.current = setInterval(() => {
      setStepIndex(prev => Math.min(prev + 1, STEPS.length - 1));
    }, 40000);

    track("research_started", {
      school_name: schoolName.trim(),
      location: location.trim(),
      social_deep_dive: includeSocial,
    });

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolName: schoolName.trim(),
          location: location.trim(),
          franchiseeName: franchiseeName.trim(),
          extraUrls: extraUrls.trim(),
          includeSocial,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${res.status})`);
      }

      const data = await res.json();
      setBriefData(data);
      setBriefInputs({
        schoolName: schoolName.trim(),
        location: location.trim(),
        franchiseeName: franchiseeName.trim(),
      });
      track("research_completed", {
        school_name: schoolName.trim(),
        location: location.trim(),
        grade_span: data?.fact_strip?.grade_span || "",
      });
    } catch (err: any) {
      track("research_failed", {
        school_name: schoolName.trim(),
        location: location.trim(),
        reason: err?.message || "unknown",
      });
      setError(`Something went sideways: ${err.message}. Try again.`);
    } finally {
      if (stepIntervalRef.current) {
        clearInterval(stepIntervalRef.current);
        stepIntervalRef.current = null;
      }
      setStepIndex(STEPS.length);
      setLoading(false);
    }
  };

  const handleMeetingsCheck = async () => {
    setError("");
    if (!schoolName.trim()) { setError("Please enter the school's name."); return; }
    if (!location.trim()) { setError("Please add the city and state."); return; }
    setMeetingsLoading(true);
    setMeetingsData(null);
    track("meetings_check_started", { school_name: schoolName.trim(), location: location.trim() });
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolName: schoolName.trim(), location: location.trim(), extraUrls: extraUrls.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setMeetingsData(data);
      track("meetings_check_completed", {
        school_name: schoolName.trim(),
        meetings_found: Array.isArray(data?.meetings) ? data.meetings.length : 0,
      });
    } catch (err: any) {
      setError(`Meeting check failed: ${err.message}`);
      track("meetings_check_failed", { school_name: schoolName.trim(), reason: err?.message || "unknown" });
    } finally {
      setMeetingsLoading(false);
    }
  };

  const handleClear = () => {
    try { sessionStorage.removeItem("apex_research_form"); } catch { /* ignore */ }
    setSchoolName("");
    setLocation("");
    setExtraUrls("");
    setBriefData(null);
    setMeetingsData(null);
    setError("");
  };

  if (status === "loading") {
    return (
      <div className="frame">
        <div style={{ textAlign: "center", marginTop: "20vh", fontFamily: "Source Serif 4, serif", fontStyle: "italic", color: "#6B7785" }}>
          Loading…
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="frame">
      <Masthead adminEmails={adminEmails} />

      <section className="hero">
        <div>
          <div className="hero-kicker">Franchisee Tool</div>
          <h1>School <span className="italic">Research</span> Agent</h1>
        </div>
        <div className="hero-deck">
          Tell the agent which school. It searches the web, reads what it finds,{" "}
          <strong>verifies its own work</strong>, and hands back the hooks, the angles, and the language to write outreach that lands.
        </div>
      </section>

      <section className="input-card">
        <div className="input-card-label">Begin Research</div>

        <span className="label">The school</span>
        <div className="field-row">
          <input
            type="text"
            className="field"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            placeholder="Westlake Elementary"
            disabled={loading}
          />
          <input
            type="text"
            className="field"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Houston, TX"
            disabled={loading}
          />
        </div>

        <span className="label">Your name and territory</span>
        <div className="field-row single">
          <div>
            <input
              type="text"
              className="field"
              value={franchiseeName}
              onChange={(e) => setFranchiseeName(e.target.value)}
              placeholder="Sarah Mitchell, Apex of Greater Houston"
              disabled={loading}
            />
            <div className="helper">Used in the email drafts</div>
          </div>
        </div>

        <span className="label">Specific pages to include (optional)</span>
        <div className="field-row single">
          <div>
            <textarea
              className="field"
              value={extraUrls}
              onChange={(e) => setExtraUrls(e.target.value)}
              placeholder={"https://schoolname.org/pta\nhttps://localnews.com/article-about-the-school"}
              disabled={loading}
              rows={3}
              style={{ resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
            />
            <div className="helper">
              One URL per line. The agent will read these first, then do its own research. Up to 5.
            </div>
          </div>
        </div>

        <div className="field-row single" style={{ marginTop: 4 }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontWeight: 400 }}>
            <input
              type="checkbox"
              checked={includeSocial}
              onChange={(e) => setIncludeSocial(e.target.checked)}
              disabled={loading}
              style={{ marginTop: 4 }}
            />
            <span style={{ fontSize: 14 }}>
              <b>Social media deep dive.</b>{" "}
              <span style={{ color: "var(--ink-soft)" }}>
                Finds and reads the school&apos;s or PTA&apos;s Facebook posts for the freshest news and fundraiser details. Runs alongside the research, so it adds little or no extra time.
              </span>
            </span>
          </label>
        </div>

        <div className="actions">
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "Researching…" : "Research this school →"}
          </button>
          <button className="btn btn-secondary" onClick={handleMeetingsCheck} disabled={loading || meetingsLoading}>
            {meetingsLoading ? "Checking meetings…" : "Check PTA meetings (quick)"}
          </button>
          <button className="btn btn-ghost" onClick={handleClear} disabled={loading || meetingsLoading}>
            Start over
          </button>
        </div>
        <div className="helper" style={{ marginTop: 10 }}>
          Deep research typically takes 4 to 6 minutes. It verifies its own work, so the brief is worth the wait.
        </div>

        {loading && (
          <div className="loading active">
            <div className="pulse"></div>
            <div style={{ flex: 1 }}>
              <div className="loading-text">
                {stepIndex < STEPS.length ? STEPS[stepIndex] : "Finalizing…"}
              </div>
              <div className="step-trail">
                {STEPS.map((s, i) => {
                  let cls = "step";
                  if (i < stepIndex) cls += " done";
                  else if (i === stepIndex) cls += " active";
                  const marker = i < stepIndex ? "✓" : (i === stepIndex ? "→" : "·");
                  return <div key={i} className={cls}>{marker}  {s}</div>;
                })}
              </div>
            </div>
          </div>
        )}

        {error && <div className="error active">{error}</div>}
      </section>

      {meetingsData && (
        <section className="meetings-card">
          <div className="meetings-head">
            <div>
              <div className="meetings-title">Upcoming PTA/PTO Meetings</div>
              <div className="meetings-sub">
                {meetingsData.school} · checked {meetingsData.checked_on} · next 60 days
              </div>
            </div>
          </div>

          {Array.isArray(meetingsData.meetings) && meetingsData.meetings.length > 0 ? (
            meetingsData.meetings.map((m: any, i: number) => (
              <div className="meeting-row" key={i}>
                <div className="meeting-main">
                  <span className={m.status === "confirmed" ? "chip chip-green" : "chip chip-amber"}>
                    {m.status === "confirmed" ? "Confirmed" : "Needs verification"}
                  </span>
                  <b>{m.org || "PTA"} {m.type === "Board" ? "Board Meeting" : "General Meeting"}</b>
                  <span className="meeting-when">
                    {m.date}{m.time ? ` · ${m.time}` : ""}{m.location ? ` · ${m.location}` : ""}
                  </span>
                </div>
                {m.type === "Board" && (
                  <div className="meeting-note">Board meetings are leadership-only; ask for an invitation before attending.</div>
                )}
                {m.notes && <div className="meeting-note">{m.notes}</div>}
                {m.source_url && (
                  <a className="meeting-src" href={m.source_url} target="_blank" rel="noopener noreferrer">Source</a>
                )}
              </div>
            ))
          ) : (
            <div className="meeting-none">
              {meetingsData.none_found_note || "No upcoming meetings were found in the next 60 days."}
            </div>
          )}

          {Array.isArray(meetingsData.where_to_watch) && meetingsData.where_to_watch.length > 0 && (
            <div className="meeting-watch">
              Where their meetings get announced:{" "}
              {meetingsData.where_to_watch.map((u: string, i: number) => (
                <a key={i} href={u} target="_blank" rel="noopener noreferrer">{u}</a>
              ))}
            </div>
          )}
          <div className="meeting-disclaimer">
            Always reconfirm the day before attending; PTA schedules move often.
          </div>
        </section>
      )}

      {briefData && (
        <BriefRenderer
          data={briefData}
          schoolName={briefInputs?.schoolName || schoolName}
          location={briefInputs?.location || location}
          franchiseeName={briefInputs?.franchiseeName || franchiseeName}
        />
      )}

      <p className="footnote">
        Researched, verified, and ready to send. <span className="accent">Apex Leadership Co.</span>
      </p>
    </div>
  );
}
