import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import { Agent, fetch as request } from 'undici';

export function publicAddress(address:string):boolean {
  try { return ipaddr.process(address).range()==='unicast'; } catch { return false; }
}
export function cleanUrl(raw:string):string|null {
  try {
    const u=new URL(raw);
    if(!['https:','http:'].includes(u.protocol)||u.username||u.password|| (u.port&&!['80','443'].includes(u.port))) return null;
    const host=u.hostname.replace(/^\[|\]$/g,'');
    if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||(!host.includes('.')&&!host.includes(':')))return null;
    if(ipaddr.isValid(host)&&!publicAddress(host))return null;
    u.hash='';
    for(const k of [...u.searchParams.keys()])if(/^utm_|^(fbclid|gclid)$/i.test(k))u.searchParams.delete(k);
    return u.href;
  } catch{return null;}
}

// Every redirect gets a fresh public-address check. Pin the connection to the
// checked address so a second DNS response cannot redirect a request internally.
export async function fetchPublic(raw:string,signal?:AbortSignal):Promise<{url:string;type:string;bytes:Uint8Array}> {
  let url=cleanUrl(raw);if(!url)throw new Error('Unsupported or non-public URL');
  for(let hops=0;hops<5;hops++){
    const u=new URL(url); const host=u.hostname.replace(/^\[|\]$/g,'');
    const addresses=ipaddr.isValid(host)?[{address:host,family:ipaddr.parse(host).kind()==='ipv6'?6:4}]:await lookup(host,{all:true});
    if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw new Error('Non-public address blocked');
    const pinned=addresses[0];
    const agent=new Agent({connect:{lookup:((_h:any,options:any,cb:any)=>{
      if(options?.all)cb(null,[pinned]);else cb(null,pinned.address,pinned.family);
    }) as any}});
    const timeout=AbortSignal.timeout(12000);const combined=signal?AbortSignal.any([signal,timeout]):timeout;
    try{
      const res=await request(url,{dispatcher:agent,redirect:'manual',signal:combined,headers:{'user-agent':'ApexResearchAgent/3.9 (public school research)','accept':'text/html,application/pdf,text/plain'}});
      if([301,302,303,307,308].includes(res.status)){
        const loc=res.headers.get('location');await res.body?.cancel();
        url=loc?cleanUrl(new URL(loc,url).href):null;if(!url)throw new Error('Invalid redirect');continue;
      }
      if(!res.ok){await res.body?.cancel();throw new Error(`HTTP ${res.status}`);}
      const max=6*1024*1024;
      if(Number(res.headers.get('content-length'))>max){await res.body?.cancel();throw new Error('Document exceeds 6 MB limit');}
      const reader=res.body?.getReader();if(!reader)throw new Error('Empty response');
      const chunks:Uint8Array[]=[];let size=0;
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new Error('Document exceeds 6 MB limit');}chunks.push(value);}
      const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
      return {url,type:res.headers.get('content-type')||'',bytes};
    }finally{await agent.close();}
  }
  throw new Error('Too many redirects');
}
