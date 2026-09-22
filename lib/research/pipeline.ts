import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { AnalysisSchema, type ResearchInput, type BriefV2, type Page, type Coverage } from './types';
import { discover } from './discover';
import { crawl } from './reader';
import { cleanUrl } from './network';
import { socialRead } from './social';
import { modelJson, VERIFY_MODEL } from './model';
import { analysisPrompt, REVIEW_INSTRUCTIONS, PROGRAM_FACTS } from './prompts';
import { validateFacts, deriveNeeds, eligibleFacts, draftGate, sourceCoverage, normalize } from './validate';

const ReviewSchema=z.object({checks:z.array(z.object({id:z.string(),verdict:z.enum(['supported','unclear','contradicted']),reason:z.string()}))});
const DraftSchema=z.object({emails:z.array(z.object({type:z.string(),subject:z.string().max(30),body:z.string().max(1800),evidence_ids:z.array(z.string()).min(1)})).max(2)});
export type ResearchDependencies={discover:typeof discover;crawl:typeof crawl;socialRead:typeof socialRead};
export async function runResearch(input:ResearchInput,client:Anthropic,outerSignal?:AbortSignal,dependencies:Partial<ResearchDependencies>={}):Promise<{brief:BriefV2;dossier:string}>{
  const dep={discover,crawl,socialRead,...dependencies};
  const started=Date.now();const overall=outerSignal?AbortSignal.any([outerSignal,AbortSignal.timeout(540000)]):AbortSignal.timeout(540000);
  const stage=(ms:number)=>AbortSignal.any([overall,AbortSignal.timeout(ms)]);
  const coverage:Coverage[]=[];
  const discovery=await dep.discover(client,input,stage(95000));coverage.push(...discovery.coverage);
  const raw=Array.isArray(input.extraUrls)?input.extraUrls:(input.extraUrls||'').split(/[\n,]+/);
  const extra=raw.map(x=>cleanUrl(/^https?:\/\//i.test(x.trim())?x.trim():'https://'+x.trim())).filter((x):x is string=>!!x).slice(0,5);
  const regular=extra.filter(u=>!/(facebook|instagram)\.com/i.test(u));
  const leads=discovery.hits.filter(h=>!/(facebook|instagram|niche|greatschools|usnews)\.com/i.test(new URL(h.url).hostname));
  leads.sort((a,b)=>Number(new URL(b.url).hostname===discovery.officialDomain)-Number(new URL(a.url).hostname===discovery.officialDomain));
  let pages=await dep.crawl([...regular,...leads.map(h=>h.url).slice(0,12)],stage(100000),28);
  // Search snippets remain inspectable but never count as a full read or valid fact receipt.
  const retrieved=new Set(pages.map(p=>p.url));
  for(const h of discovery.hits.filter(h=>!retrieved.has(h.url)).slice(0,20))pages.push({id:'',url:h.url,title:h.title,kind:'snippet',status:'snippet_only',text:h.snippet,accessed_at:new Date().toISOString(),published_at:null,links:[],category:'Search leads',reason:'Search result only; not used to support a factual claim.'});
  if(input.includeSocial){
    const socialLinks=[...extra,...pages.filter(p=>p.status==='read').flatMap(p=>p.links.map(l=>l.url)),...discovery.hits.map(h=>h.url)];
    const social=await dep.socialRead(socialLinks,stage(70000));pages.push(...social.pages);coverage.push(social.coverage);
  }else coverage.push({area:'Public social posts',status:'not_requested',detail:'Optional Facebook research was not requested. Instagram and image-only posts are not extracted.'});
  pages=pages.map((p,i)=>({...p,id:`S${i+1}`}));coverage.push(...sourceCoverage(pages));
  if(!pages.some(p=>p.status==='read'))throw new Error('NO_READABLE_SOURCES');
  const analysis=await modelJson(client,analysisPrompt(input,pages),AnalysisSchema,stage(100000));
  const {facts,rejected}=validateFacts(analysis,pages);let verification='Independent claim review did not complete. Matching a quotation is not confirmation of the interpretation.';
  if(facts.length&&Date.now()-started<410000){
    try{
      const reviewed=await modelJson(client,REVIEW_INSTRUCTIONS+'\n'+JSON.stringify(facts),ReviewSchema,stage(65000),VERIFY_MODEL(),6500);
      let count=0;for(const fact of facts){const result=reviewed.checks.find(r=>r.id===fact.id);if(!result)continue;count++;
        // Structural warnings cannot be overridden by a model opinion.
        if(result.verdict==='supported'&&fact.support==='source_matched')fact.support='reviewed';
        if(result.verdict!=='supported'){fact.support=result.verdict;fact.warnings.push(result.reason);}
      }
      verification=`${count}/${facts.length} source-matched claims received an independent interpretation review. No official source was automatically confirmed. ${rejected.length} claims were excluded for invalid receipts or campus mismatch.`;
      coverage.push({area:'Claim review',status:count===facts.length?'read':'partial',detail:verification});
    }catch{coverage.push({area:'Claim review',status:'unavailable',detail:verification});}
  }else coverage.push({area:'Claim review',status:'unavailable',detail:verification});
  const needs=deriveNeeds(analysis,facts);const usable=new Set(eligibleFacts(facts).map(f=>f.id));
  const people=analysis.people.map(p=>{
    const evidence_ids=p.evidence_ids.filter(id=>{const f=facts.find(f=>f.id===id);return usable.has(id)&&f?.category==='people'&&normalize(f.excerpt).includes(normalize(p.name))&&!!p.name.trim();});
    return {...p,evidence_ids,tenure:evidence_ids.every(id=>facts.find(f=>f.id===id)?.currency!=='current')?'Listing found; current tenure needs confirmation.':p.tenure};
  }).filter(p=>p.evidence_ids.length);
  const grade=input.gradeScope==='unknown'?analysis.grade_scope:input.gradeScope;
  const gate=draftGate(input,grade,facts);let emails:BriefV2['emails']=[];let draftNote=gate.note;
  if(gate.allowed&&!overall.aborted){
    try{
      const draft=await modelJson(client,`${PROGRAM_FACTS}\nWrite up to two drafts using only the facts supplied below. Match relationship ${input.relationship}; unknown with no Apex history may use an exploratory introduction. Confirmed current uses support/planning; former acknowledges past experience without guessing why it ended. Follow-up is a template: do not assert an email was already sent. Grade scope ${grade}. Sender ${input.franchiseeName||'[Your name]'}. Need hypotheses are questions, never asserted pain. Never congratulate an old achievement as current. Use dated historic references explicitly. Prefer decision-relevant details to unrelated compliments. Return {"emails":[{"type":"","subject":"","body":"","evidence_ids":["F1"]}]}. Every school-specific claim must be supported by listed evidence IDs. No invented quotes, statistics, current tenure, calendar availability or program promises.\nFACTS:${JSON.stringify(eligibleFacts(facts))}\nNEEDS:${JSON.stringify(needs)}`,DraftSchema,stage(60000));
      emails=draft.emails.filter(e=>e.evidence_ids.every(id=>usable.has(id))&&!/zero (?:work|hassle|planning|risk)|100%|\b[23] (?:to|-) [23] times|guarantee|no added work/i.test(e.body));
      if(emails.length!==draft.emails.length)draftNote+=' A draft failed the evidence or claims check and was withheld.';
      if(emails.length){
        const checked=await modelJson(client,`Review outreach against the supplied source facts and program facts. A need hypothesis must be a question, not an asserted problem. Reject stale facts presented as current, invented promises, incorrect program scope, false familiarity, invented sender availability, or school claims not entailed by the cited facts. Return {"checks":[{"index":0,"safe":true,"reason":""}]}. One verdict per draft; use safe:false if uncertain.\nPROGRAM:${PROGRAM_FACTS}\nSCOPE:${grade}\nRELATIONSHIP:${input.relationship}\nFACTS:${JSON.stringify(eligibleFacts(facts))}\nDRAFTS:${JSON.stringify(emails)}`,z.object({checks:z.array(z.object({index:z.number().int(),safe:z.boolean(),reason:z.string()}))}),stage(30000),VERIFY_MODEL(),2000);
        const before=emails.length;emails=emails.filter((_,i)=>checked.checks.some(c=>c.index===i&&c.safe));
        if(emails.length<before)draftNote+=' Drafts that did not pass the final evidence review were withheld.';
      }
    }catch{emails=[];draftNote='The research completed, but drafts could not be validated. Use the questions and evidence below to prepare outreach.';}
  }
  const publicApex=facts.some(f=>f.support!=='contradicted'&&/\bapex\b/i.test(f.claim+' '+f.excerpt));
  const gaps=[...analysis.gaps];if(rejected.length)gaps.push(`${rejected.length} proposed claims were excluded because their source receipts or school identity did not match.`);
  if(!needs.length)gaps.unshift('No sufficiently supported need hypothesis emerged. Begin with discovery rather than assigning a segment.');
  const brief:BriefV2={schema_version:2,generated_at:new Date().toISOString(),school_identity:analysis.school_identity,
    relationship:{status:input.relationship,basis:input.relationship==='unknown'?'Current relationship was not supplied by the owner.':'Relationship supplied by the owner; not independently checked against CRM.',public_apex_history:publicApex,check_required:publicApex&&['unknown','prospect'].includes(input.relationship)},grade_scope:grade,
    facts,needs,people,gaps,next_steps:[...(gate.allowed?[]:[gate.note]),...needs.slice(0,3).map(n=>n.question),...people.slice(0,2).map(p=>p.question)].filter(Boolean),emails,draft_note:draftNote,coverage,
    sources:pages.map(({text,links,...p})=>p),verification_summary:verification,owner_notes:input.ownerNotes,input_context:{relationship:input.relationship,gradeScope:input.gradeScope}};
  return {brief,dossier:JSON.stringify({input,analysis,rejected,pages,coverage})};
}
