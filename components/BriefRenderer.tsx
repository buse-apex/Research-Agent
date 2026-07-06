"use client";

import { track } from "../app/providers";

interface BriefData {
  fact_strip?: {
    grade_span?: string;
    enrollment?: string;
    district?: string;
    current_fundraiser?: string;
    decision_path?: string;
  };
  the_read?: string;
  pull_quote?: { text: string; attribution: string };
  angle?: string;
  emails?: { type: string; subject: string; body: string }[];
  personalization_bank?: {
    description?: string;
    named_people?: string[];
    money_trail?: string[];
    recent_moments?: string[];
    their_words?: string[];
    calendar_timing?: string[];
    opener_lines?: string[];
    ps_lines?: string[];
  };
  verification_summary?: string;
  sources?: { title: string; url: string; deep_read?: boolean }[];
}

function escape(str: string): string {
  if (!str) return "";
  return str.replace(/—/g, ": ").replace(/–/g, ": ");
}

// For the downloaded HTML document: escape markup so scraped titles or model
// output containing < > & " can never break (or inject into) the document.
function htmlEscape(str: string): string {
  return escape(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function BriefRenderer({
  data,
  schoolName,
  location,
  franchiseeName,
}: {
  data: BriefData;
  schoolName: string;
  location: string;
  franchiseeName: string;
}) {
  const copyEmail = (email: { subject: string; body: string }, btnId: string) => {
    navigator.clipboard.writeText(
      `Subject: ${escape(email.subject)}\n\n${escape(email.body)}`
    );
    flashButton(btnId, "Copied");
  };

  const copyLine = (text: string, btnId: string) => {
    navigator.clipboard.writeText(escape(text));
    flashButton(btnId, "Copied");
  };

  const flashButton = (btnId: string, label: string) => {
    const btn = document.getElementById(btnId) as HTMLButtonElement | null;
    if (btn) {
      const original = btn.textContent;
      btn.textContent = label;
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove("copied");
      }, 2000);
    }
  };

  const handleDownload = () => {
    const today = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const fs = data.fact_strip || {};
    const bank = data.personalization_bank;

    const bankSection = (label: string, items?: string[]) =>
      items && items.length
        ? `<h3>${label}</h3><ul>${items
            .map((x) => `<li>${htmlEscape(x)}</li>`)
            .join("")}</ul>`
        : "";

    const briefHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Research Brief: ${htmlEscape(schoolName)}</title>
<style>
  body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 740px; margin: 40px auto; padding: 0 30px; color: #1A2330; line-height: 1.6; background: #fff; }
  .header { padding-bottom: 16px; margin-bottom: 24px; border-bottom: 2px solid #E86A1F; display: flex; justify-content: space-between; align-items: baseline; }
  .header .brand { font-weight: 700; font-size: 15px; color: #16324F; }
  .header .brand span { color: #E86A1F; }
  .header .date { font-size: 12px; color: #8A94A3; }
  h1 { font-size: 26px; font-weight: 800; color: #16324F; margin-bottom: 6px; letter-spacing: -0.02em; }
  .meta { color: #4A5568; font-size: 13.5px; margin-bottom: 14px; }
  .fact-strip { display: flex; flex-wrap: wrap; gap: 6px 20px; padding: 10px 14px; background: #F6F7F9; border: 1px solid #E4E7EC; border-radius: 8px; margin-bottom: 24px; font-size: 12.5px; color: #4A5568; }
  .fact-strip b { color: #16324F; }
  h2 { font-size: 17px; color: #16324F; margin-top: 32px; margin-bottom: 12px; font-weight: 700; padding-bottom: 8px; border-bottom: 1px solid #E4E7EC; }
  h3 { font-size: 12px; color: #8A94A3; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 16px; margin-bottom: 6px; font-weight: 700; }
  .quote { background: #F6F7F9; border-left: 4px solid #E86A1F; padding: 14px 18px; margin: 14px 0; font-style: italic; font-size: 15px; border-radius: 0 8px 8px 0; }
  .quote-attr { font-style: normal; font-size: 11px; text-transform: uppercase; color: #8A94A3; margin-top: 8px; letter-spacing: 0.05em; font-weight: 600; }
  .angle { background: #fff; border: 1px solid #E4E7EC; border-left: 4px solid #16324F; border-radius: 8px; padding: 14px 18px; margin: 14px 0; font-size: 14px; }
  .angle-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.07em; color: #16324F; font-weight: 700; margin-bottom: 5px; }
  ul { padding-left: 20px; } li { margin-bottom: 5px; font-size: 14px; }
  .email { background: #F6F7F9; border: 1px solid #E4E7EC; border-radius: 10px; padding: 18px 22px; margin-bottom: 14px; }
  .email-type { font-weight: 700; color: #16324F; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
  .email-subject { font-weight: 600; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #E4E7EC; font-size: 14.5px; }
  .email-body { white-space: pre-wrap; font-size: 14px; line-height: 1.65; }
  .bank-line { background: #F6F7F9; border-left: 3px solid #E86A1F; padding: 9px 13px; margin-bottom: 7px; font-size: 13.5px; border-radius: 0 6px 6px 0; }
  .verification { background: #EDF7F2; border: 1px solid #C9E8D9; border-radius: 8px; padding: 10px 14px; margin: 12px 0; font-size: 12.5px; color: #1D5E41; }
  .source { margin-bottom: 8px; font-size: 13px; color: #4A5568; }
  .source a { color: #2B5F8A; font-weight: 600; }
  .deep { display: inline-block; background: #FDF1E8; color: #E86A1F; font-size: 10px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; padding: 1px 6px; border-radius: 4px; margin-left: 6px; }
</style></head><body>
<div class="header"><div class="brand">Apex <span>Research Agent</span></div><div class="date">${today}</div></div>
<h1>Research Brief: ${htmlEscape(schoolName)}</h1>
<div class="meta">${htmlEscape(location)} · Prepared for ${htmlEscape(franchiseeName || "Apex Franchisee")}</div>
<div class="fact-strip">
  ${fs.grade_span ? `<span><b>${htmlEscape(fs.grade_span)}</b>${fs.enrollment ? " · " + htmlEscape(fs.enrollment) : ""}</span>` : ""}
  ${fs.district ? `<span>${htmlEscape(fs.district)}</span>` : ""}
  ${fs.current_fundraiser ? `<span>Current: <b>${htmlEscape(fs.current_fundraiser)}</b></span>` : ""}
  ${fs.decision_path ? `<span>Decision path: <b>${htmlEscape(fs.decision_path)}</b></span>` : ""}
</div>

<h2>1 · The Read</h2>
<p>${htmlEscape(data.the_read || "")}</p>
${data.pull_quote?.text ? `<div class="quote">"${htmlEscape(data.pull_quote.text)}"<div class="quote-attr">${htmlEscape(data.pull_quote.attribution || "")}</div></div>` : ""}
${data.angle ? `<div class="angle"><div class="angle-label">The Angle</div>${htmlEscape(data.angle)}</div>` : ""}

<h2>2 · Ready-to-Send Drafts</h2>
${(data.emails || [])
  .map(
    (e) => `<div class="email">
<div class="email-type">${htmlEscape(e.type)}</div>
<div class="email-subject">Subject: ${htmlEscape(e.subject)}</div>
<div class="email-body">${htmlEscape(e.body)}</div>
</div>`
  )
  .join("")}

<h2>3 · Personalization Bank</h2>
${bank?.description ? `<p style="font-size:13px;color:#4A5568;">${htmlEscape(bank.description)}</p>` : ""}
${bankSection("Named People", bank?.named_people)}
${bankSection("Money Trail", bank?.money_trail)}
${bankSection("Recent Moments &amp; Wins", bank?.recent_moments)}
${bankSection("Their Words", bank?.their_words)}
${bankSection("Calendar &amp; Timing", bank?.calendar_timing)}
${
  bank?.opener_lines?.length
    ? `<h3>Ready-to-Use Opener Lines</h3>${bank.opener_lines
        .map((x) => `<div class="bank-line">${htmlEscape(x)}</div>`)
        .join("")}`
    : ""
}
${
  bank?.ps_lines?.length
    ? `<h3>Ready-to-Use P.S. Lines</h3>${bank.ps_lines
        .map((x) => `<div class="bank-line">${htmlEscape(x)}</div>`)
        .join("")}`
    : ""
}

<h2>4 · Sources</h2>
${data.verification_summary ? `<div class="verification"><b>Verified:</b> ${htmlEscape(data.verification_summary)}</div>` : ""}
${(data.sources || [])
  .map(
    (s) =>
      `<div class="source"><a href="${htmlEscape(s.url)}">${htmlEscape(s.title)}</a>${s.deep_read ? '<span class="deep">Deep Read</span>' : ""}</div>`
  )
  .join("")}
</body></html>`;

    const blob = new Blob([briefHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `research-brief-${schoolName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.html`;
    a.click();
    track("brief_downloaded", { school_name: schoolName });
    URL.revokeObjectURL(url);
  };

  const fs = data.fact_strip || {};
  const bank = data.personalization_bank;

  const bankCards = [
    { label: "Named People", items: bank?.named_people },
    { label: "Money Trail", items: bank?.money_trail },
    { label: "Recent Moments & Wins", items: bank?.recent_moments },
    { label: "Their Words", items: bank?.their_words },
    { label: "Calendar & Timing", items: bank?.calendar_timing },
  ].filter((c) => c.items && c.items.length > 0);

  return (
    <div className="results active">
      <div className="results-header">
        <div className="results-header-title">
          Research Brief: {escape(schoolName)}
        </div>
        <button className="btn btn-download" onClick={handleDownload}>
          Download Brief
        </button>
      </div>

      {(fs.grade_span || fs.district || fs.current_fundraiser || fs.decision_path) && (
        <div className="fact-strip">
          {fs.grade_span && (
            <span className="fact">
              <b>{escape(fs.grade_span)}</b>
              {fs.enrollment ? <> · {escape(fs.enrollment)}</> : null}
            </span>
          )}
          {fs.district && <span className="fact">{escape(fs.district)}</span>}
          {fs.current_fundraiser && (
            <span className="fact">
              Current: <b>{escape(fs.current_fundraiser)}</b>
            </span>
          )}
          {fs.decision_path && (
            <span className="fact">
              Decision path: <b>{escape(fs.decision_path)}</b>
            </span>
          )}
        </div>
      )}

      {/* 1 · THE READ */}
      <div className="section-header">
        <span className="section-num">1</span>
        <h2 className="section-title">The Read</h2>
      </div>
      {data.the_read && (
        <div className="read-text">{escape(data.the_read)}</div>
      )}
      {data.pull_quote?.text && (
        <div className="pull-quote">
          <div className="pull-quote-text">&ldquo;{escape(data.pull_quote.text)}&rdquo;</div>
          {data.pull_quote.attribution && (
            <div className="pull-quote-attr">{escape(data.pull_quote.attribution)}</div>
          )}
        </div>
      )}
      {data.angle && (
        <div className="angle-card">
          <div className="angle-label">The Angle</div>
          {escape(data.angle)}
        </div>
      )}

      {/* 2 · EMAILS */}
      {data.emails && data.emails.length > 0 && (
        <>
          <div className="section-header">
            <span className="section-num">2</span>
            <h2 className="section-title">Ready-to-Send Drafts</h2>
          </div>
          {data.emails.map((email, i) => (
            <div key={i} className="email-block">
              <div className="email-header">
                <span className="email-type">{escape(email.type)}</span>
                <button
                  id={`email-btn-${i}`}
                  className="copy-btn"
                  onClick={() => copyEmail(email, `email-btn-${i}`)}
                >
                  Copy Email
                </button>
              </div>
              <div className="email-body">
                <div className="subject-line">{escape(email.subject)}</div>
                {escape(email.body)}
              </div>
            </div>
          ))}
        </>
      )}

      {/* 3 · PERSONALIZATION BANK */}
      {bank && (
        <>
          <div className="section-header">
            <span className="section-num">3</span>
            <h2 className="section-title">Personalization Bank</h2>
            <span className="section-subtitle">Every fact lives here, once</span>
          </div>
          {bank.description && (
            <div className="bank-intro">{escape(bank.description)}</div>
          )}
          <div className="bank-grid">
            {bankCards.map((c, ci) => (
              <div key={ci} className="bank-card">
                <div className="bank-card-label">{c.label}</div>
                <ul>
                  {(c.items || []).map((item, ii) => (
                    <li key={ii}>{escape(item)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {bank.opener_lines && bank.opener_lines.length > 0 && (
            <div className="ready-line-block">
              <div className="ready-line-label">Ready-to-use opener lines</div>
              {bank.opener_lines.map((line, li) => (
                <div key={li} className="ready-line">
                  <div className="ready-line-text">{escape(line)}</div>
                  <button
                    id={`opener-btn-${li}`}
                    className="copy-line-btn"
                    onClick={() => copyLine(line, `opener-btn-${li}`)}
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          )}
          {bank.ps_lines && bank.ps_lines.length > 0 && (
            <div className="ready-line-block">
              <div className="ready-line-label">Ready-to-use P.S. lines</div>
              {bank.ps_lines.map((line, li) => (
                <div key={li} className="ready-line">
                  <div className="ready-line-text">{escape(line)}</div>
                  <button
                    id={`ps-btn-${li}`}
                    className="copy-line-btn"
                    onClick={() => copyLine(line, `ps-btn-${li}`)}
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 4 · SOURCES */}
      {data.sources && data.sources.length > 0 && (
        <>
          <div className="section-header">
            <span className="section-num">4</span>
            <h2 className="section-title">Sources</h2>
          </div>
          {data.verification_summary && (
            <div className="verification-line">
              <b>Verified:</b> {escape(data.verification_summary)}
            </div>
          )}
          <div className="sources-card">
            {data.sources.map((s, i) => (
              <div key={i} className="source-item">
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {escape(s.title)}
                </a>
                {s.deep_read && <span className="deep-tag">Deep Read</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default BriefRenderer;
