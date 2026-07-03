"use client";

import { useRef } from "react";

interface BriefData {
  sources?: { title: string; url: string; what_it_revealed: string; deep_read?: boolean }[];
  verification_summary?: string;
  the_read?: string;
  pull_quote?: { text: string; attribution: string };
  hooks?: { label: string; content: string; color: string }[];
  fundraising?: { current_program: string; signals: string[]; angle: string };
  voice?: { tone: string; vocabulary: string[]; avoid: string };
  emails?: { type: string; subject: string; body: string }[];
  personalization_bank?: {
    description?: string;
    specific_programs?: string[];
    recent_moments?: string[];
    school_values_phrases?: string[];
    named_humans?: string[];
    fundraising_context?: string[];
    opener_lines?: string[];
    ps_lines?: string[];
  };
}

interface BriefRendererProps {
  data: BriefData;
  schoolName: string;
  location: string;
  franchiseeName: string;
}

function escape(str: string): string {
  if (!str) return "";
  return str.replace(/—/g, ": ").replace(/–/g, ": ");
}

function escapeWithBreaks(str: string): string {
  return escape(str).split("\n").map((line, i, arr) => (
    <span key={i}>
      {line}
      {i < arr.length - 1 ? <br /> : null}
    </span>
  )) as any;
}

export function BriefRenderer({ data, schoolName, location, franchiseeName }: BriefRendererProps) {
  const copyEmail = (i: number) => {
    const e = data.emails?.[i];
    if (!e) return;
    const text = `Subject: ${e.subject}\n\n${e.body}`;
    navigator.clipboard.writeText(text);
    const btn = document.querySelectorAll<HTMLButtonElement>(".copy-btn")[i];
    if (btn) {
      const original = btn.textContent;
      btn.textContent = "Copied";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove("copied");
      }, 2000);
    }
  };

  const copyLine = (text: string, btnId: string) => {
    navigator.clipboard.writeText(text);
    const btn = document.getElementById(btnId) as HTMLButtonElement | null;
    if (btn) {
      const original = btn.textContent;
      btn.textContent = "Copied";
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

    const briefHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Research Brief: ${escape(schoolName)}</title>
<style>
  body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 740px; margin: 40px auto; padding: 0 30px; color: #1A2330; line-height: 1.6; background: #fff; }
  .header { padding-bottom: 16px; margin-bottom: 28px; border-bottom: 2px solid #E86A1F; display: flex; justify-content: space-between; align-items: baseline; }
  .header .brand { font-weight: 700; font-size: 15px; color: #16324F; }
  .header .brand span { color: #E86A1F; }
  .header .date { font-size: 12px; color: #8A94A3; }
  h1 { font-size: 26px; font-weight: 800; color: #16324F; margin-bottom: 6px; letter-spacing: -0.02em; }
  .meta { color: #4A5568; font-size: 13.5px; margin-bottom: 28px; }
  h2 { font-size: 17px; color: #16324F; margin-top: 34px; margin-bottom: 14px; font-weight: 700; padding-bottom: 8px; border-bottom: 1px solid #E4E7EC; }
  h3 { font-size: 12px; color: #8A94A3; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 18px; margin-bottom: 6px; font-weight: 700; }
  .quote { background: #F6F7F9; border-left: 4px solid #E86A1F; padding: 16px 20px; margin: 16px 0; font-style: italic; font-size: 15px; border-radius: 0 8px 8px 0; }
  .quote-attr { font-style: normal; font-size: 11px; text-transform: uppercase; color: #8A94A3; margin-top: 8px; letter-spacing: 0.05em; font-weight: 600; }
  ul { padding-left: 20px; } li { margin-bottom: 5px; font-size: 14px; }
  .source { margin-bottom: 8px; font-size: 13px; color: #4A5568; }
  .source a { color: #2B5F8A; font-weight: 600; }
  .email { background: #F6F7F9; border: 1px solid #E4E7EC; border-radius: 10px; padding: 18px 22px; margin-bottom: 14px; }
  .email-type { font-weight: 700; color: #16324F; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
  .email-subject { font-weight: 600; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #E4E7EC; font-size: 14.5px; }
  .email-body { white-space: pre-wrap; font-size: 14px; line-height: 1.65; }
  .verification { background: #EDF7F2; border: 1px solid #C9E8D9; border-radius: 8px; padding: 12px 16px; margin: 14px 0; font-size: 13px; color: #1D5E41; }
  .verification strong { display: block; text-transform: uppercase; letter-spacing: 0.05em; font-size: 10.5px; margin-bottom: 3px; }
  .vocab span { display: inline-block; background: #F0F2F5; border: 1px solid #E4E7EC; border-radius: 14px; padding: 3px 10px; font-size: 12.5px; margin: 2px 4px 2px 0; color: #16324F; font-weight: 500; }
  .bank-line { background: #F6F7F9; border-left: 3px solid #E86A1F; padding: 9px 13px; margin-bottom: 7px; font-size: 13.5px; border-radius: 0 6px 6px 0; }
</style></head><body>
<div class="header"><div class="brand">Apex <span>Research Agent</span></div><div class="date">${today}</div></div>
<h1>Research Brief: ${escape(schoolName)}</h1>
<div class="meta">${escape(location)} · Prepared for ${escape(franchiseeName || "Apex Franchisee")}</div>
<h2><span class="num">1</span>What the Agent Found</h2>
<p style="font-size: 17px; line-height: 1.6;">${escape(data.the_read || "")}</p>
${data.verification_summary ? `<div class="verification"><strong>Verification Pass</strong>${escape(data.verification_summary)}</div>` : ""}
${data.pull_quote ? `<div class="quote">"${escape(data.pull_quote.text)}"<div class="quote-attr">— ${escape(data.pull_quote.attribution)}</div></div>` : ""}
<h3>Sources Read</h3>
${(data.sources || []).map(s => `<div class="source"><a href="${s.url}">${escape(s.title)}</a><br><span style="color:#3A4655;">${escape(s.what_it_revealed)}</span></div>`).join("")}
<h2><span class="num">2</span>Personalization Hooks</h2>
${(data.hooks || []).map(h => `<h3>${escape(h.label)}</h3><p>${escape(h.content).replace(/\n/g, "<br>")}</p>`).join("")}
<h2><span class="num">3</span>The Fundraising Picture</h2>
<h3>Current Program</h3><p>${escape(data.fundraising?.current_program || "")}</p>
<h3>Signals</h3><ul>${(data.fundraising?.signals || []).map(s => `<li>${escape(s)}</li>`).join("")}</ul>
<h3>Recommended Angle</h3><p>${escape(data.fundraising?.angle || "")}</p>
<h2><span class="num">4</span>Voice & Values</h2>
<h3>How They Sound</h3><p>${escape(data.voice?.tone || "")}</p>
<h3>Vocabulary to Mirror</h3><div class="vocab">${(data.voice?.vocabulary || []).map(v => `<span>${escape(v)}</span>`).join("")}</div>
<h3>What to Avoid</h3><p>${escape(data.voice?.avoid || "")}</p>
<h2><span class="num">5</span>Email Drafts</h2>
${(data.emails || []).map((e, i) => `<div class="email"><div class="email-type">${i + 1} · ${escape(e.type)}</div><div class="email-subject">Subject: ${escape(e.subject)}</div><div class="email-body">${escape(e.body)}</div></div>`).join("")}
${data.personalization_bank ? `
<h2>6 · Personalization Bank</h2>
${data.personalization_bank.description ? `<p style="font-size:13px;color:#4A5568;">${escape(data.personalization_bank.description)}</p>` : ""}
${(data.personalization_bank.specific_programs || []).length ? `<h3>Specific Programs &amp; Initiatives</h3><ul>${(data.personalization_bank.specific_programs || []).map(x => `<li>${escape(x)}</li>`).join("")}</ul>` : ""}
${(data.personalization_bank.recent_moments || []).length ? `<h3>Recent Moments &amp; Events</h3><ul>${(data.personalization_bank.recent_moments || []).map(x => `<li>${escape(x)}</li>`).join("")}</ul>` : ""}
${(data.personalization_bank.school_values_phrases || []).length ? `<h3>School Values (Their Words)</h3><ul>${(data.personalization_bank.school_values_phrases || []).map(x => `<li>${escape(x)}</li>`).join("")}</ul>` : ""}
${(data.personalization_bank.named_humans || []).length ? `<h3>Named People to Reference</h3><ul>${(data.personalization_bank.named_humans || []).map(x => `<li>${escape(x)}</li>`).join("")}</ul>` : ""}
${(data.personalization_bank.fundraising_context || []).length ? `<h3>Fundraising Context</h3><ul>${(data.personalization_bank.fundraising_context || []).map(x => `<li>${escape(x)}</li>`).join("")}</ul>` : ""}
${(data.personalization_bank.opener_lines || []).length ? `<h3>Ready-to-Use Opener Lines</h3>${(data.personalization_bank.opener_lines || []).map(x => `<div class="bank-line">${escape(x)}</div>`).join("")}` : ""}
${(data.personalization_bank.ps_lines || []).length ? `<h3>Ready-to-Use P.S. Lines</h3>${(data.personalization_bank.ps_lines || []).map(x => `<div class="bank-line">${escape(x)}</div>`).join("")}` : ""}
` : ""}
</body></html>`;

    const blob = new Blob([briefHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `apex_brief_${schoolName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!data) return null;

  return (
    <div className="results active">
      <div className="results-header">
        <div className="results-header-title">The Brief</div>
        <button className="btn btn-download" onClick={handleDownload}>↓ Download Brief</button>
      </div>

      <div className="section-header">
        <span className="section-num">1</span>
        <h2 className="section-title">What the Agent Found</h2>
        <span className="section-subtitle">Sources & narrative read</span>
      </div>

      {data.sources && data.sources.length > 0 && (
        <div className="sources">
          <div className="sources-label">Sources the agent read</div>
          {data.sources.map((s, i) => (
            <div key={i} className="source-item">
              <a href={s.url} target="_blank" rel="noopener noreferrer">{escape(s.title)}</a>
              {s.deep_read && <span className="deep-tag">deep read</span>}
              <br />
              {escape(s.what_it_revealed)}
            </div>
          ))}
        </div>
      )}

      {data.the_read && <p className="read-text">{escape(data.the_read)}</p>}

      {data.verification_summary && (
        <div className="verification-note">
          <strong>Verification Pass</strong>
          {escape(data.verification_summary)}
        </div>
      )}

      {data.pull_quote && (
        <div className="pull-quote">
          <div className="pull-quote-text">{escape(data.pull_quote.text)}</div>
          <div className="pull-quote-attr">{escape(data.pull_quote.attribution)}</div>
        </div>
      )}

      <div className="section-header">
        <span className="section-num">2</span>
        <h2 className="section-title">Personalization Hooks</h2>
        <span className="section-subtitle">For your opening lines</span>
      </div>
      <div className="insight-grid">
        {(data.hooks || []).map((h, i) => (
          <div key={i} className={`insight ${h.color}`}>
            <div className="insight-label">{escape(h.label)}</div>
            <div className="insight-content" style={{ whiteSpace: "pre-wrap" }}>{escape(h.content)}</div>
          </div>
        ))}
      </div>

      <div className="section-header">
        <span className="section-num">3</span>
        <h2 className="section-title">The Fundraising Picture</h2>
        <span className="section-subtitle">Where they stand, where Apex fits</span>
      </div>
      {data.fundraising && (
        <>
          <div className="stacked-card orange">
            <div className="stacked-card-label">Current Program · Visible Evidence</div>
            <div className="stacked-card-content">{escape(data.fundraising.current_program)}</div>
          </div>
          <div className="stacked-card blue">
            <div className="stacked-card-label">Signals from the Research</div>
            <div className="stacked-card-content">
              <ul>{data.fundraising.signals.map((s, i) => <li key={i}>{escape(s)}</li>)}</ul>
            </div>
          </div>
          <div className="stacked-card deep">
            <div className="stacked-card-label">Recommended Angle</div>
            <div className="stacked-card-content">{escape(data.fundraising.angle)}</div>
          </div>
        </>
      )}

      <div className="section-header">
        <span className="section-num">4</span>
        <h2 className="section-title">Voice &amp; Values to Mirror</h2>
        <span className="section-subtitle">Speak their language</span>
      </div>
      {data.voice && (
        <>
          <div className="stacked-card blue">
            <div className="stacked-card-label">How They Sound</div>
            <div className="stacked-card-content">{escape(data.voice.tone)}</div>
          </div>
          <div className="stacked-card orange">
            <div className="stacked-card-label">Vocabulary to Mirror</div>
            <div className="stacked-card-content">
              {data.voice.vocabulary.map((v, i) => (
                <span key={i} className="vocab-tag">{escape(v)}</span>
              ))}
            </div>
          </div>
          <div className="stacked-card deep">
            <div className="stacked-card-label">What to Avoid</div>
            <div className="stacked-card-content">{escape(data.voice.avoid)}</div>
          </div>
        </>
      )}

      <div className="section-header">
        <span className="section-num">5</span>
        <h2 className="section-title">Ready-to-Send Drafts</h2>
        <span className="section-subtitle">Substantive, personalized, ready to ship</span>
      </div>
      {(data.emails || []).map((e, i) => (
        <div key={i} className="email-block">
          <div className="email-header">
            <div className="email-type">{i + 1} · {escape(e.type)}</div>
            <button className="copy-btn" onClick={() => copyEmail(i)}>Copy</button>
          </div>
          <div className="email-body">
            <div className="subject-line">{escape(e.subject)}</div>
            {escape(e.body)}
          </div>
        </div>
      ))}

      {data.personalization_bank && (
        <>
          <div className="section-header">
            <span className="section-num">6</span>
            <h2 className="section-title">Personalization Bank</h2>
            <span className="section-subtitle">Swap any of these into your emails</span>
          </div>
          {data.personalization_bank.description && (
            <div className="bank-intro">{escape(data.personalization_bank.description)}</div>
          )}
          <div className="bank-grid">
            {[
              { label: "Specific Programs & Initiatives", items: data.personalization_bank.specific_programs },
              { label: "Recent Moments & Events", items: data.personalization_bank.recent_moments },
              { label: "School Values (Their Words)", items: data.personalization_bank.school_values_phrases },
              { label: "Named People to Reference", items: data.personalization_bank.named_humans },
              { label: "Fundraising Context", items: data.personalization_bank.fundraising_context },
            ].filter(c => c.items && c.items.length > 0).map((c, ci) => (
              <div key={ci} className="bank-card">
                <div className="bank-card-label">{c.label}</div>
                <ul>{(c.items || []).map((item, ii) => <li key={ii}>{escape(item)}</li>)}</ul>
              </div>
            ))}
          </div>
          {data.personalization_bank.opener_lines && data.personalization_bank.opener_lines.length > 0 && (
            <div className="ready-line-block">
              <div className="ready-line-label">Ready-to-use opener lines</div>
              {data.personalization_bank.opener_lines.map((line, li) => (
                <div key={li} className="ready-line">
                  <div className="ready-line-text">{escape(line)}</div>
                  <button id={`opener-btn-${li}`} className="copy-line-btn" onClick={() => copyLine(line, `opener-btn-${li}`)}>Copy</button>
                </div>
              ))}
            </div>
          )}
          {data.personalization_bank.ps_lines && data.personalization_bank.ps_lines.length > 0 && (
            <div className="ready-line-block">
              <div className="ready-line-label">Ready-to-use P.S. lines</div>
              {data.personalization_bank.ps_lines.map((line, li) => (
                <div key={li} className="ready-line">
                  <div className="ready-line-text">{escape(line)}</div>
                  <button id={`ps-btn-${li}`} className="copy-line-btn" onClick={() => copyLine(line, `ps-btn-${li}`)}>Copy</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
