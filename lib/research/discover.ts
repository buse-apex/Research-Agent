import Anthropic from '@anthropic-ai/sdk';
import { cleanUrl } from './network';
import { MODEL, SYSTEM, modelJson } from './model';
import { z } from 'zod';
import type { Coverage, ResearchInput } from './types';

export type Hit={url:string;title:string;snippet:string;query:string};
export type Discovery={hits:Hit[];coverage:Coverage[];officialDomain:string|null;organization:string|null};
async function google(query:string,signal:AbortSignal):Promise<Hit[]>{
  const res=await fetch('https://google.serper.dev/search',{method:'POST',signal:AbortSignal.any([signal,AbortSignal.timeout(10000)]),headers:{'X-API-KEY':process.env.SERPER_API_KEY!,'Content-Type':'application/json'},body:JSON.stringify({q:query,num:6})});
  if(!res.ok)throw new Error(`Google search HTTP ${res.status}`);
  const data=await res.json();return (data.organic||[]).flatMap((x:any)=>{const url=cleanUrl(x.link);return url?[{url,title:String(x.title||''),snippet:String(x.snippet||''),query}]:[];});
}
function harvest(blocks:any[],query:string):Hit[]{
  const found:Hit[]=[];
  const visit=(x:any)=>{if(!x||typeof x!=='object')return;if(x.type==='web_search_result'&&x.url){const url=cleanUrl(x.url);if(url)found.push({url,title:String(x.title||''),snippet:String(x.encrypted_content?'':x.snippet||''),query});}for(const [k,v]of Object.entries(x))if(k!=='encrypted_content'&&typeof v==='object'){if(Array.isArray(v))v.forEach(visit);else visit(v);}};
  blocks.forEach(visit);return found;
}
async function webDiscover(client:Anthropic,input:ResearchInput,signal:AbortSignal):Promise<Hit[]>{
  const query=`Find public sources for ${input.schoolName}, ${input.location}. Establish the exact school and parent organization, then find their official pages, officers, volunteer committees, giving, budget/minutes, dated newsletters, and fundraiser history for the current and previous two school years. Search those trails; do not write a sales pitch. Use original sources where possible and exclude other campuses. Return a short source list.`;
  let messages:any[]=[{role:'user',content:query}];const hits:Hit[]=[];
  for(let i=0;i<2;i++){
    const res=await client.messages.create({model:MODEL(),max_tokens:3000,system:SYSTEM,messages,tools:[{type:'web_search_20250305',name:'web_search',max_uses:i?3:7} as any]},{signal,maxRetries:0});
    hits.push(...harvest(res.content,query));
    if((res.stop_reason as string)!=='pause_turn')break;
    messages.push({role:'assistant',content:res.content});
  }
  // Only tool-observed URLs enter retrieval; prose URLs are not trusted.
  return hits;
}
export async function discover(client:Anthropic,input:ResearchInput,signal:AbortSignal):Promise<Discovery>{
  const hits:Hit[]=[];const coverage:Coverage[]=[];let domain:string|null=null;let organization:string|null=null;
  const q=`"${input.schoolName}" ${input.location}`;
  if(process.env.SERPER_API_KEY){
    const initial=await Promise.allSettled([`${q} official school`,`${q} PTA PTO PTSO`].map(s=>google(s,signal)));
    initial.forEach(x=>{if(x.status==='fulfilled')hits.push(...x.value);});
    if(hits.length){
      try{
        const identity=await modelJson(client,`Select the exact school's official domain and parent organization from these search leads. They are leads, not verified facts. Use null if uncertain. JSON: {"domain":null,"organization":null}. School: ${input.schoolName}, ${input.location}\n${JSON.stringify(hits)}`,z.object({domain:z.string().nullable(),organization:z.string().nullable()}),signal,VERIFY_MODEL_LOCAL(),1200);
        const hosts=new Set(hits.map(h=>new URL(h.url).hostname));
        if(identity.domain){const h=identity.domain.replace(/^https?:\/\//,'').split('/')[0];if(hosts.has(h))domain=h;}
        organization=identity.organization;
      }catch{coverage.push({area:'Identity planning',status:'partial',detail:'Could not resolve a domain plan; general queries were used.'});}
    }
    const scope=domain?`site:${domain}`:q;const parent=organization?`"${organization}" ${input.location}`:q;
    const queries=[`${scope} officers board committee volunteer`,`${parent} budget minutes treasurer annual report`,`${scope} fundraiser giving fun run Apex Booster`,`${scope} newsletter archive calendar`,`${parent} fundraising goal raised playground`,`${parent} volunteers cancelled unfilled`,`${scope} instruction staff time school improvement`,`${scope} family participation inclusion`];
    const results=await Promise.allSettled(queries.map(s=>google(s,signal)));
    results.forEach(x=>{if(x.status==='fulfilled')hits.push(...x.value);});
    const failed=initial.filter(x=>x.status==='rejected').length+results.filter(x=>x.status==='rejected').length;
    coverage.push({area:'Google discovery',status:failed?'partial':'read',detail:`${10-failed}/10 query requests completed. Search matches are leads, not verified facts.`});
  }else coverage.push({area:'Google discovery',status:'unavailable',detail:'Google search is not configured; using model web search discovery.'});
  if(hits.length<5||!domain){
    try{const found=await webDiscover(client,input,signal);hits.push(...found);coverage.push({area:'Web discovery',status:found.length?'read':'partial',detail:`${found.length} tool-observed search leads collected.`});}
    catch{coverage.push({area:'Web discovery',status:'unavailable',detail:'Web search did not complete within the available budget.'});}
  }
  return {hits:[...new Map(hits.map(h=>[h.url,h])).values()],coverage,officialDomain:domain,organization};
}
const VERIFY_MODEL_LOCAL=()=>process.env.VERIFY_MODEL||'claude-haiku-4-5';
