"use client";
import React, { useRef, useState } from 'react';
import type { BriefV2 } from '@/lib/research/types';
import { LABELS } from '@/lib/research/types';

const text=(s:string)=>s.replace(/_/g,' ');
const safeHref=(s:string)=>/^https?:\/\//i.test(s)?s:undefined;
const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export const printCss=`body{font:15px/1.6 Arial,sans-serif;color:#243a50;max-width:1000px;margin:40px auto;padding:0 25px}h1,h2,h3{color:#1e4679}h1{font-size:30px}h2{border-bottom:2px solid #f47c35;padding-bottom:8px;margin-top:32px}article,aside{border:1px solid #d9e3ec;padding:20px;margin:15px 0;break-inside:avoid}blockquote{border-left:3px solid #f47c35;padding:12px;background:#f2f6fa;margin:12px 0}table{border-collapse:collapse;width:100%;font-size:13px}td,th{padding:10px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}a{color:#1e4679;overflow-wrap:anywhere}.eb-meta,.eb-small{font-size:12px;color:#596d80}.eb-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.eb-body{white-space:pre-wrap}.eb-badge{display:inline-block;border:1px solid #c1ccd8;padding:2px 8px;margin:4px;font-size:11px}.eb-warning{background:#fff3e8}.eb-source{margin:8px 0}.eb-facts p{margin:8px 0}@media(max-width:640px){.eb-grid{grid-template-columns:1fr}.eb-scroll{overflow-x:auto}}@media print{body{margin:0;padding:0;font-size:10pt}.eb-grid{display:block}details{display:block}thead{display:table-header-group}tr{break-inside:avoid}}`;

export function EvidenceBriefContent({data,schoolName,location,franchiseeName}:{data:BriefV2;schoolName:string;location:string;franchiseeName:string}){
  const sources=new Map(data.sources.map(s=>[s.id,s]));
  const sourceFor=(id:string)=>{const f=data.facts.find(f=>f.id===id);const s=f?sources.get(f.source_id):null;return <a key={id} href={'#evidence-'+id}>{id}{s?' · '+s.title.slice(0,55):''} </a>;};
  return <>
    <p className="eb-meta">APEX / SCHOOL RESEARCH · {new Date(data.generated_at).toLocaleDateString('en-US',{timeZone:'UTC'})}</p>
    <h1>{schoolName}</h1><p>{location} · Prepared for {franchiseeName||'Apex franchisee'}</p>
    <div className="eb-grid"><aside><b>Relationship</b><p>{text(data.relationship.status)}</p><p className="eb-small">{data.relationship.basis}</p>{data.relationship.public_apex_history&&<p>Public Apex history found. Historical activity does not establish a current booking.</p>}</aside><aside><b>Program audience</b><p>{text(data.grade_scope)}</p><p className="eb-small">{data.school_identity.grade_span||'Grade span not established'} · {data.school_identity.district||'District not established'}</p></aside></div>
    {data.owner_notes&&<aside><b>Owner context</b><p>{data.owner_notes}</p><p className="eb-small">Owner-supplied context, separate from public evidence.</p></aside>}
    <h2>1 · Findings that change the conversation</h2>
    {data.facts.filter(f=>f.support!=='contradicted'&&f.support!=='unclear'&&['fundraiser','money','capacity','people'].includes(f.category)).slice(0,4).map(f=><article key={f.id}><b>{f.claim}</b><p className="eb-small">{text(f.currency)} · {f.event_date||f.school_year||'Date not established'} · {sourceFor(f.id)}</p></article>)}
    <h2>2 · Needs to explore</h2><p className="eb-small">Online evidence suggests questions. Every need below remains a hypothesis until the school confirms it.</p>
    {!data.needs.length&&<aside>No clear need emerged from the available evidence. Begin with open discovery.</aside>}
    {data.needs.map((n,i)=><article key={i}><span className="eb-badge">{text(n.confidence)}</span><h3>{LABELS[n.need]}</h3><p>{n.hypothesis}</p><p><b>Possible job:</b> {n.job_to_be_done}</p><p><b>Evidence:</b> {n.evidence_ids.map(sourceFor)}</p><p><b>Counterevidence:</b> {n.counterevidence_ids.length?n.counterevidence_ids.map(sourceFor):'None established in this run.'}</p><p><b>Another explanation:</b> {n.alternative_explanation}</p><blockquote><b>Ask:</b> {n.question}</blockquote><p><b>Message direction:</b> {n.message_direction}</p><p><b>Proof to bring:</b> {n.proof_to_bring}</p></article>)}
    <h2>3 · People and decision path</h2>
    {!data.people.length&&<p>No supported named contact was established. Ask the school who owns fundraising and approvals.</p>}
    {data.people.map((p,i)=><article key={i}><h3>{p.name}</h3><p>{p.role} · {p.tenure}</p><p>{p.evidence_ids.map(sourceFor)}</p><p><b>Confirm:</b> {p.question}</p></article>)}
    <h2>4 · Next conversation</h2><ol>{data.next_steps.map((s,i)=><li key={i}>{s}</li>)}</ol>
    <h3>Still unknown</h3><ul>{data.gaps.map((s,i)=><li key={i}>{s}</li>)}</ul>
    <h2>5 · Outreach drafts</h2><aside className={data.emails.length?'':'eb-warning'}>{data.draft_note}</aside>
    {data.emails.map((e,i)=><article key={i}><span className="eb-badge">{e.type}</span><h3>Subject: {e.subject}</h3><p className="eb-body">{e.body}</p><p className="eb-small">Evidence used: {e.evidence_ids.map(sourceFor)}</p></article>)}
    <h2>6 · Evidence and dates</h2><p className="eb-small">{data.verification_summary}</p>
    <div className="eb-facts">{data.facts.map(f=>{const s=sources.get(f.source_id);return <details id={'evidence-'+f.id} key={f.id}><summary><b>{f.id}: {f.claim}</b> <span className="eb-badge">{text(f.support)}</span></summary><blockquote>{f.excerpt}</blockquote><p>{f.entity} · {text(f.currency)} · Event: {f.event_date||'unknown'} · School year: {f.school_year||'unknown'}</p>{f.amount_scope!=='not_applicable'&&<p>Financial scope: {text(f.amount_scope)} · {text(f.amount_type)}</p>}{f.warnings.map((w,i)=><p className="eb-warning" key={i}>{w}</p>)}{s&&<p className="eb-small"><a href={safeHref(s.url)} target="_blank" rel="noreferrer">{s.title}</a> · Accessed {s.accessed_at.slice(0,10)} · Published {s.published_at||'unknown'}</p>}</details>;})}</div>
    <h2>7 · Research coverage</h2><div className="eb-scroll"><table><thead><tr><th>Research area</th><th>Status</th><th>What happened</th></tr></thead><tbody>{data.coverage.map((c,i)=><tr key={i}><td>{c.area}</td><td>{text(c.status)}</td><td>{c.detail}</td></tr>)}</tbody></table></div>
    <h3>Source register</h3><p className="eb-small">Read means content was retrieved and extracted. It does not mean the page is current or every claim on it is accurate. Search-only leads are not used as factual receipts.</p>
    {data.sources.map(s=><div className="eb-source" key={s.id}><a href={safeHref(s.url)} target="_blank" rel="noreferrer">{s.id} · {s.title}</a> <span className="eb-badge">{text(s.status)}</span>{s.reason&&<p className="eb-small">{s.reason}</p>}{s.truncated&&<p className="eb-small">Long source was capped; some text was not retained.</p>}</div>)}
  </>;
}
export function EvidenceBrief(props:{data:BriefV2;schoolName:string;location:string;franchiseeName:string}){
  const content=useRef<HTMLDivElement>(null);const [notice,setNotice]=useState('');
  function download(){
    const clone=content.current?.cloneNode(true) as HTMLElement|undefined;if(!clone)return;
    clone.querySelectorAll('details').forEach(d=>d.open=true);
    const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(props.schoolName)} | Apex research brief</title><style>${printCss}</style></head><body>${clone.innerHTML}</body></html>`;
    const url=URL.createObjectURL(new Blob([html],{type:'text/html'}));const a=document.createElement('a');a.href=url;a.download=`research-brief-${props.schoolName.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.html`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function copy(i:number){try{const e=props.data.emails[i];await navigator.clipboard.writeText(`Subject: ${e.subject}\n\n${e.body}`);setNotice('Draft copied.');}catch{setNotice('Could not copy. Select the draft text below.');}}
  return <section className="evidence-brief"><div className="eb-actions"><button className="btn btn-primary" onClick={download}>Download research brief</button>{props.data.emails.map((_,i)=><button className="btn btn-secondary" key={i} onClick={()=>copy(i)}>Copy draft {i+1}</button>)}<span role="status">{notice}</span></div><div ref={content}><EvidenceBriefContent {...props}/></div></section>;
}
