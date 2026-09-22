import type { Page, Coverage } from './types';
import { cleanUrl } from './network';
export function normalizeFacebookUrl(raw:string):string|null{
  const clean=cleanUrl(raw);if(!clean)return null;const u=new URL(clean);
  if(!/(^|\.)facebook\.com$/i.test(u.hostname))return null;
  const match=u.pathname.match(/^\/p\/[^/]*-(\d{8,})\/?$/);
  if(match)return `https://www.facebook.com/${match[1]}`;
  // profile.php IDs identify the page; never strip them as tracking.
  if(u.pathname==='/profile.php')return /^\d+$/.test(u.searchParams.get('id')||'')?`https://www.facebook.com/profile.php?id=${u.searchParams.get('id')}`:null;
  u.search='';return u.href;
}
export function selectPosts(items:any[],now=new Date()):{text:string;date:string|null;url:string|null}[]{
  const cutoff=now.getTime()-730*86400000;
  const records=items.map(it=>{
    const raw=it.time||it.date||it.publishedTime;const ms=typeof raw==='number'?(raw<1e12?raw*1000:raw):Date.parse(raw||'');
    const text=String(it.text||it.message||'');
    return {text,date:Number.isFinite(ms)?new Date(ms).toISOString():null,url:cleanUrl(it.url||it.postUrl||''),ms};
  }).filter(p=>p.text.trim()&&(p.date===null||p.ms>=cutoff));
  const signal=/fundrais|donat|pledge|raised|\$|budget|goal|sponsor|auction|fun.run|apex|booster|PT[ASO]|volunteer|unfilled|cancel|shortfall|instruction|staff.time|participat|committee/i;
  const important=records.filter(p=>signal.test(p.text)).slice(0,28);
  const recent=records.filter(p=>p.date&&p.ms>=now.getTime()-62*86400000&&!important.includes(p)).slice(0,8);
  return [...important,...recent].map(({text,date,url})=>({text:text.slice(0,8000),date,url}));
}
export async function socialRead(urls:string[],signal:AbortSignal):Promise<{pages:Page[];coverage:Coverage}>{
  if(!process.env.APIFY_TOKEN)return {pages:[],coverage:{area:'Public social posts',status:'unavailable',detail:'Facebook reading is not configured. Public school newsletters are still researched.'}};
  const targets=[...new Set(urls.map(normalizeFacebookUrl).filter((s):s is string=>!!s))].slice(0,2);
  if(!targets.length)return {pages:[],coverage:{area:'Public social posts',status:'not_found',detail:'No school or parent Facebook page was found in retrieved links or search leads. Instagram content is not fetched.'}};
  const key=process.env.APIFY_TOKEN;
  const results=await Promise.all(targets.map(async url=>{
    let runId:string|undefined;let completed=false;let note='';const pages:Page[]=[];
    try{
      const options={signal,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'}};
      const start=await fetch('https://api.apify.com/v2/acts/apify~facebook-posts-scraper/runs?timeout=55',{...options,method:'POST',body:JSON.stringify({startUrls:[{url}],resultsLimit:120})});
      if(!start.ok)throw new Error(`Social provider HTTP ${start.status}`);
      runId=(await start.json()).data?.id;if(!runId)throw new Error('No social run ID');
      const end=Date.now()+55000;
      while(Date.now()<end&&!signal.aborted){
        await new Promise<void>((resolve,reject)=>{const done=()=>{signal.removeEventListener('abort',abort);resolve();};const timer=setTimeout(done,2000);const abort=()=>{clearTimeout(timer);reject(new Error('Social time limit'));};signal.addEventListener('abort',abort,{once:true});});
        const response=await fetch(`https://api.apify.com/v2/actor-runs/${runId}`,options);
        const status=(await response.json()).data?.status;
        if(['SUCCEEDED','FAILED','TIMED-OUT','ABORTED'].includes(status)){completed=status==='SUCCEEDED';break;}
      }
      const data=await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?clean=true&format=json&limit=120`,options);
      if(!data.ok)throw new Error('Social dataset unavailable');
      const items=await data.json();const posts=selectPosts(Array.isArray(items)?items:[]);
      for(const post of posts)pages.push({id:'',url:post.url||url,title:'Public Facebook post',kind:'social',status:'read',text:post.text,accessed_at:new Date().toISOString(),published_at:post.date,links:[],category:'Public social posts',reason:post.date?undefined:'Post date unknown; not classified as recent.'});
      note=`${url}: ${posts.length} readable posts retained; ${completed?'provider completed':'partial results'}. Requested up to 120 posts; two-year coverage is not guaranteed.`;
    }catch(e){note=`${url}: ${(e as Error).message}. No claim of complete coverage.`;}
    finally{if(runId&&!completed){try{await fetch(`https://api.apify.com/v2/actor-runs/${runId}/abort`,{method:'POST',signal:AbortSignal.timeout(4000),headers:{Authorization:`Bearer ${key}`}});}catch{}}}
    return {pages,note,completed};
  }));
  return {pages:results.flatMap(r=>r.pages),coverage:{area:'Public social posts',status:results.every(r=>r.completed&&r.pages.length)?'read':results.some(r=>r.pages.length)?'partial':'unavailable',detail:results.map(r=>r.note).join(' ')}};
}
