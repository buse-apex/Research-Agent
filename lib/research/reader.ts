import * as cheerio from 'cheerio';
import { cleanUrl, fetchPublic } from './network';
import type { Page } from './types';

export const TRAILS:Record<string,RegExp>={
  people:/officer|board|staff|team|leadership|committee|volunteer/i,
  finances:/budget|minutes|treasurer|annual.report|financial|giving|fundrais|donat|pledge/i,
  history:/newsletter|archive|calendar|event|news|recap/i,
  participation:/family|inclusion|community|participation|improvement.plan|handbook/i,
};
export function category(url:string,title=''):string{
  const s=url+' '+title;
  if(/budget|minutes|treasurer|financial|annual.report/i.test(s))return 'Budgets and minutes';
  if(/officer|committee|volunteer|staff|our.team/i.test(s))return 'People and capacity';
  if(/newsletter|archive|calendar|events|news/i.test(s))return 'Newsletters and event history';
  if(/fundrais|donat|giving|pledge|fun.run/i.test(s))return 'Fundraising and giving';
  return 'School and parent organization';
}
export function extractHtml(html:string,url:string){
  const $=cheerio.load(html);
  const title=$('title').first().text().trim()||$('h1').first().text().trim()||new URL(url).hostname;
  const published=$('meta[property="article:published_time"]').attr('content')||$('time[datetime]').first().attr('datetime')||null;
  const links:{url:string;label:string}[]=[];
  $('a[href]').each((_,a)=>{try{const link=cleanUrl(new URL($(a).attr('href')!,url).href);if(link)links.push({url:link,label:$(a).text().trim().slice(0,160)});}catch{}});
  $('script,style,noscript,nav,header,footer,[role="navigation"],#footer,.footer,.site-footer,.site-header').remove();
  $('br').replaceWith('\n');$('p,li,div,section,article,tr,h1,h2,h3,h4').append('\n');
  const main=$('main').first(); const article=$('article').first();
  const text=(main.length?main.text():article.length?article.text():$('body').text()).replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').trim();
  return {title,published,text,links:[...new Map(links.map(l=>[l.url,l])).values()]};
}
export async function extractPdf(bytes:Uint8Array):Promise<string>{
  const {extractText,getDocumentProxy}=await import('unpdf');
  const pdf=await getDocumentProxy(bytes);
  try{return (await extractText(pdf,{mergePages:true})).text;}
  finally{await (pdf as unknown as {destroy?:()=>Promise<void>}).destroy?.();}
}
export async function readPage(url:string,signal?:AbortSignal):Promise<Page>{
  const base:Page={id:'',url,title:url,kind:'html',status:'failed',text:'',accessed_at:new Date().toISOString(),published_at:null,links:[],category:category(url)};
  try{
    const r=await fetchPublic(url,signal);base.url=r.url;
    if(/pdf/i.test(r.type)||Buffer.from(r.bytes.slice(0,5)).toString()==='%PDF-'){
      base.kind='pdf';base.text=await extractPdf(r.bytes);
      base.title=decodeURIComponent(new URL(r.url).pathname.split('/').pop()||'PDF');
      if(base.text.trim().length<30)throw new Error('PDF has no extractable text; manual reading or OCR needed');
    }else if(/html|text\/plain|xhtml/.test(r.type)){
      const extracted=extractHtml(new TextDecoder().decode(r.bytes),r.url);
      base.title=extracted.title;base.text=extracted.text;base.links=extracted.links;base.published_at=extracted.published;
      if(base.text.length<100)throw new Error('Little readable content; may require JavaScript or manual access');
    }else{base.status='unsupported';base.reason=`Unsupported content type: ${r.type}`;return base;}
    base.truncated=base.text.length>100000;base.text=base.text.slice(0,100000);base.status='read';base.category=category(base.url,base.title);return base;
  }catch(e){base.reason=(e as Error).message;base.status=/403|429|blocked/i.test(base.reason)?'blocked':'failed';return base;}
}
export function rankLink(link:{url:string;label:string}):number{
  const s=link.url+' '+link.label;
  if(/facebook|instagram|twitter|youtube|signin|login|mailto:/i.test(link.url))return 0;
  let score=Object.values(TRAILS).reduce((n,r)=>n+(r.test(s)?3:0),0);
  if(/PTA|PTO|PTSO|parent.association|parent.organization/i.test(s))score+=4;
  if(/\.pdf(?:\?|$)/i.test(s))score+=2;
  return score;
}
export async function crawl(seeds:string[],signal:AbortSignal,maxPages=24):Promise<Page[]>{
  const queue=seeds.map(url=>({url,depth:0})); const visited=new Set<string>(); const pages:Page[]=[];
  // Prioritized links, two linked hops. All reads and failures are retained.
  while(queue.length&&pages.length<maxPages&&!signal.aborted){
    const batch:typeof queue=[];
    while(queue.length&&batch.length<4&&pages.length+batch.length<maxPages){const x=queue.shift()!;const u=cleanUrl(x.url);if(!u||visited.has(u))continue;visited.add(u);batch.push({...x,url:u});}
    const results=await Promise.all(batch.map(async x=>({x,page:await readPage(x.url,signal)})));
    const follow:typeof queue=[];
    for(const {x,page} of results){pages.push(page);if(page.status==='read'&&x.depth<2){
      const candidates=page.links.filter(l=>rankLink(l)>0).sort((a,b)=>rankLink(b)-rankLink(a));
      // Reserve a candidate from each trail before selecting the overall top links.
      const diverse=Object.values(TRAILS).flatMap(r=>candidates.filter(l=>r.test(l.url+' '+l.label)).slice(0,2));
      for(const l of [...new Map([...diverse,...candidates.slice(0,6)].map(l=>[l.url,l])).values()].slice(0,10))follow.push({url:l.url,depth:x.depth+1});
    }}
    // Follow strong school links before lower-value search results.
    queue.unshift(...follow);
  }
  return pages.map((p,i)=>({...p,id:`S${i+1}`}));
}
export function selectPassages(text:string,max=14000):string{
  if(text.length<=max)return text;
  // Very long lines occur in PDFs and minified pages. Split them so an early
  // boilerplate paragraph cannot consume the entire passage budget.
  const lines=text.split('\n').flatMap(line=>line.match(/.{1,600}(?:\s|$)|.{1,600}/g)||['']);const selected=new Set<number>();let used=0;
  const pattern=/fundrais|PTA|PTO|PTSO|president|treasurer|budget|minutes|volunteer|staff|goal|raised|\$|Apex|Booster|instruction|cancel|shortfall|participat|202[3-9]/i;
  for(let i=0;i<Math.min(4,lines.length)&&used+lines[i].length<max/3;i++){selected.add(i);used+=lines[i].length;}
  for(let i=0;i<lines.length;i++)if(pattern.test(lines[i]))for(let j=Math.max(0,i-1);j<=Math.min(lines.length-1,i+2);j++){if(!selected.has(j)&&used+lines[j].length<max){selected.add(j);used+=lines[j].length;}}
  return [...selected].sort((a,b)=>a-b).map(i=>lines[i]).join('\n').slice(0,max);
}
