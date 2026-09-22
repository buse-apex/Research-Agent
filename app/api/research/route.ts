import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import Anthropic from '@anthropic-ai/sdk';
import { authOptions } from '@/lib/auth';
import { logResearchRequest } from '@/lib/db';
import { InputSchema } from '@/lib/research/types';
import { runResearch } from '@/lib/research/pipeline';
export const runtime='nodejs';
export const maxDuration=600;
export const dynamic='force-dynamic';
export async function POST(req:Request){
  const session=await getServerSession(authOptions);
  if(!session?.user?.email)return NextResponse.json({error:'Unauthorized'},{status:401});
  let raw:unknown;try{raw=await req.json();}catch{return NextResponse.json({error:'Invalid JSON'},{status:400});}
  const parsed=InputSchema.safeParse(raw);
  if(!parsed.success)return NextResponse.json({error:'Check the school, location and optional context fields.'},{status:400});
  if(!process.env.ANTHROPIC_API_KEY)return NextResponse.json({error:'The research service is not configured.'},{status:503});
  try{
    const client=new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY,maxRetries:0,timeout:100000});
    const {brief,dossier}=await runResearch(parsed.data,client,req.signal);
    let briefId:number|null=null;
    try{briefId=await logResearchRequest({userEmail:session.user.email,userName:session.user.name||null,schoolName:parsed.data.schoolName,schoolLocation:parsed.data.location,franchiseeName:parsed.data.franchiseeName||null,briefData:brief,dossier});}
    catch{brief.coverage.push({area:'Saved history',status:'unavailable',detail:'This run could not be saved to history. Download the brief if you want to keep it.'});}
    return NextResponse.json({...brief,briefId});
  }catch(error:any){
    const message=String(error?.message||'');
    if(message==='NO_READABLE_SOURCES')return NextResponse.json({error:'No readable public sources were retrieved. Add the official school or parent-organization URL and try again.'},{status:422});
    if(error?.status===429)return NextResponse.json({error:'The research service reached its rate limit. Please try again later.'},{status:429});
    if(req.signal.aborted||/abort|timeout/i.test(message))return NextResponse.json({error:'Research exceeded the time limit. Try again with the official school and PTO links.'},{status:504});
    console.error('Research failed:',error?.name||'Error');
    return NextResponse.json({error:'Research could not be completed and validated. Please try again.'},{status:502});
  }
}
