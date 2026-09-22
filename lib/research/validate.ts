import type { Analysis, Fact, Page, Need, ResearchInput } from './types';
export const normalize=(s:string)=>s.normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
export function dateSupported(date:string,excerpt:string):boolean{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
  const d=new Date(date+'T12:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date)return false;
  const y=d.getUTCFullYear(),m=d.getUTCMonth()+1,day=d.getUTCDate();
  const month=d.toLocaleString('en-US',{month:'long',timeZone:'UTC'}).toLowerCase();
  const s=normalize(excerpt);
  return s.includes(date)||new RegExp(`\\b0?${m}[/.-]0?${day}[/.-]${y}\\b`).test(s)||new RegExp(`\\b${month}(?:\\s+)${day}(?:st|nd|rd|th)?[,]?\\s+${y}\\b`).test(s)||new RegExp(`\\b${month.slice(0,3)}\\.?\\s+${day}(?:st|nd|rd|th)?[,]?\\s+${y}\\b`).test(s);
}
export function validateFacts(analysis:Analysis,pages:Page[],now=new Date()):{facts:Fact[];rejected:string[]}{
  const sources=new Map(pages.map(p=>[p.id,p]));const ids=new Set<string>();const rejected:string[]=[];const facts:Fact[]=[];
  for(const item of analysis.facts){
    const p=sources.get(item.source_id);
    if(ids.has(item.id)||!p||p.status!=='read'||item.campus_match==='no'||!normalize(p.text).includes(normalize(item.excerpt))){rejected.push(item.id);continue;}
    ids.add(item.id);const f:Fact={...item,support:item.campus_match==='yes'?'source_matched':'unclear',warnings:[]};
    if(f.event_date&&!dateSupported(f.event_date,f.excerpt)){f.event_date=null;f.currency='undated';f.warnings.push('Proposed event date was not explicitly supported by the quoted passage.');f.support='unclear';}
    if(f.school_year&&!normalize(f.excerpt).includes(normalize(f.school_year))){f.school_year=null;f.warnings.push('School year was not explicit in the quoted passage.');f.support='unclear';}
    const syStart=now.getUTCMonth()>=7?now.getUTCFullYear():now.getUTCFullYear()-1;
    const yearStart=`${syStart}-08-01`;
    if(f.event_date&&f.event_date<yearStart){f.currency='historical';f.warnings.push('Historical event; does not establish a current booking.');}
    if(!f.event_date&&!f.school_year){f.currency='undated';if(f.category==='people')f.warnings.push('Listing found; current tenure needs confirmation.');}
    if(f.school_year&&Number(f.school_year.slice(0,4))<syStart)f.currency='historical';
    if(item.campus_match==='uncertain')f.warnings.push('School or campus identity is uncertain.');
    facts.push(f);
  }
  return {facts,rejected};
}
export function eligibleFacts(facts:Fact[]):Fact[]{return facts.filter(f=>['source_matched','reviewed'].includes(f.support)&&f.campus_match==='yes');}
export function deriveNeeds(analysis:Analysis,facts:Fact[]):Need[]{
  const valid=new Set(eligibleFacts(facts).map(f=>f.id));const all=new Set(facts.map(f=>f.id));
  const direct:Record<string,RegExp>={workload:/cancel|not enough|shortage|unfilled|unable to|burn.?out|need more help/i,funding_goal:/goal|target|shortfall|still need|funding gap/i,value:/fee|split|net proceeds|cost|keep more|expensive/i,participation:/increase participation|participation goal|barrier|left out|include every/i,school_day:/instructional time|disrupt|staff time|teacher workload|schedule conflict/i,other:/goal|concern|problem|need/i};
  return analysis.needs.map(n=>({...n,evidence_ids:n.evidence_ids.filter(id=>valid.has(id)),counterevidence_ids:n.counterevidence_ids.filter(id=>all.has(id))})).filter(n=>n.evidence_ids.length).map(n=>({...n,state:'hypothesis' as const,confidence:(n.evidence_ids.some(id=>{const f=facts.find(f=>f.id===id);return f?.support==='reviewed'&&f.currency!=='historical'&&direct[n.need].test(f.excerpt);})?'supported_hypothesis':'tentative') as Need['confidence']}));
}
export function draftGate(input:ResearchInput,grade:Analysis['grade_scope'],facts:Fact[]):{allowed:boolean;note:string}{
  const apex=facts.some(f=>f.support!=='contradicted'&&/\bapex\b/i.test(f.claim+' '+f.excerpt));
  if(apex&&['unknown','prospect'].includes(input.relationship))return {allowed:false,note:'Public Apex history was found. Confirm the current relationship with the owner before choosing cold, renewal or former-customer outreach.'};
  const scope=input.gradeScope==='unknown'?grade:input.gradeScope;
  if(!['elementary','middle'].includes(scope))return {allowed:false,note:'Confirm the elementary or middle school audience before drafting a program pitch. Mixed or high school grades need a specific local scope.'};
  if(!eligibleFacts(facts).some(f=>f.category==='identity'))return {allowed:false,note:'School identity has not been established with usable evidence. Confirm identity before drafting.'};
  return {allowed:true,note:'Drafts use sourced observations and exploratory language. Confirm local program details before sending.'};
}
export function sourceCoverage(pages:Page[]){
  return ['School and parent organization','People and capacity','Budgets and minutes','Newsletters and event history','Fundraising and giving'].map(area=>{
    const attempted=pages.filter(p=>p.category===area);const read=attempted.filter(p=>p.status==='read');
    return {area,status:(read.length?(attempted.length>read.length?'partial':'read'):attempted.length?'unavailable':'not_found') as 'partial'|'read'|'unavailable'|'not_found',detail:`${read.length} readable sources; ${attempted.length} attempted. ${attempted.length?'Coverage is bounded, not exhaustive.':'No matching document was retrieved in this run; this does not establish absence.'}`};
  });
}
