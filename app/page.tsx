"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Masthead } from "@/components/Masthead";
import { track } from "./providers";
import { BriefRenderer } from "@/components/BriefRenderer";

const STEPS = [
  "Searching the web for the school",
  "Reading the school's website end to end",
  "Reading the PTA / PTO page for board roster",
  "Looking for recent news and named contacts",
  "Verification pass: checking for missed details",
  "Writing emails and building the personalization bank",
];

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [schoolName, setSchoolName] = useState("");
  const [location, setLocation] = useState("");
  const [franchiseeName, setFranchiseeName] = useState("");
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
    }, 7000);

    track("research_started", {
      school_name: schoolName.trim(),
      location: location.trim(),
    });

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolName: schoolName.trim(),
          location: location.trim(),
          franchiseeName: franchiseeName.trim(),
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

  const handleClear = () => {
    setSchoolName("");
    setLocation("");
    setBriefData(null);
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

        <div className="actions">
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "Researching…" : "Research this school →"}
          </button>
          <button className="btn btn-ghost" onClick={handleClear} disabled={loading}>
            Start over
          </button>
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
