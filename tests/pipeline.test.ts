import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type Anthropic from '@anthropic-ai/sdk';
import { runResearch, type ResearchDependencies } from '../lib/research/pipeline';
import { EvidenceBriefContent } from '../components/EvidenceBrief';
import { analysis, input, page, withApex } from './fixtures/school';
import type { Analysis } from '../lib/research/types';

const dependencies:ResearchDependencies={
  discover:async()=>({hits:[],coverage:[],officialDomain:'school.example.org',organization:'Cedar Grove PTO'}),
  crawl:async()=>[structuredClone(page)],
  socialRead:async()=>({pages:[],coverage:{area:'Public social posts',status:'unavailable',detail:'Provider unavailable in this test.'}}),
};
function client(responses:unknown[]){
  const calls:any[]=[];const mock={messages:{create:async(args:any)=>{calls.push(args);assert.ok(responses.length,'Unexpected model request');const result=responses.shift();if(result instanceof Error)throw result;return {content:[{type:'text',text:JSON.stringify(result)}],stop_reason:'end_turn'};}}};
  return {api:mock as unknown as Anthropic,calls};
}
const review=(a:Analysis)=>({checks:a.facts.map(f=>({id:f.id,verdict:'supported',reason:'Supported by the quoted passage.'}))});
const draft={emails:[{type:'Introduction',subject:'Playground plans',body:'Your PTO page lists a playground funding goal. Is that still a priority for your team? I would like to learn what you need from your next fundraiser.',evidence_ids:['F3']}]};
test('pipeline holds drafts when Apex history conflicts with a prospect assumption',async()=>{
  const a=withApex();const mock=client([a,review(a)]);
  const {brief,dossier}=await runResearch({...input,relationship:'prospect'},mock.api,undefined,dependencies);
  assert.equal(mock.calls.length,2);assert.equal(brief.emails.length,0);assert.equal(brief.relationship.check_required,true);
  assert.match(brief.draft_note,/Public Apex history/);assert.equal(JSON.parse(dossier).pages[0].text,page.text);
  assert.ok(!('text' in brief.sources[0]));
});
test('pipeline passes usable evidence through drafting and a separate draft review',async()=>{
  const mock=client([analysis,review(analysis),draft,{checks:[{index:0,safe:true,reason:'Supported and exploratory.'}]}]);
  const {brief}=await runResearch({...input,includeSocial:true},mock.api,undefined,dependencies);
  assert.equal(mock.calls.length,4);assert.equal(brief.emails.length,1);
  assert.equal(brief.needs[0].state,'hypothesis');assert.equal(brief.needs[0].confidence,'tentative');
  assert.ok(brief.coverage.some(c=>c.area==='Public social posts'&&c.status==='unavailable'));
});
test('a draft rejected by the final evidence review is withheld',async()=>{
  const mock=client([analysis,review(analysis),draft,{checks:[{index:0,safe:false,reason:'Claim overstates the evidence.'}]}]);
  const {brief}=await runResearch(input,mock.api,undefined,dependencies);
  assert.equal(brief.emails.length,0);assert.match(brief.draft_note,/withheld/);
});
test('a draft with an invented evidence ID never reaches final review',async()=>{
  const mock=client([analysis,review(analysis),{emails:[{...draft.emails[0],evidence_ids:['made-up']}]}]);
  const {brief}=await runResearch(input,mock.api,undefined,dependencies);
  assert.equal(brief.emails.length,0);assert.equal(mock.calls.length,3);
});
test('an unavailable reviewer leaves an honest partial research result',async()=>{
  const mock=client([analysis,new Error('Reviewer unavailable'),new Error('Draft service unavailable')]);
  const {brief}=await runResearch(input,mock.api,undefined,dependencies);
  assert.equal(brief.facts[0].support,'source_matched');assert.equal(brief.emails.length,0);
  assert.ok(brief.coverage.some(c=>c.area==='Claim review'&&c.status==='unavailable'));
});
test('no readable sources stops the run before any model-generated findings',async()=>{
  const mock=client([]);
  await assert.rejects(runResearch(input,mock.api,undefined,{...dependencies,crawl:async()=>[]}),/NO_READABLE_SOURCES/);
  assert.equal(mock.calls.length,0);
});
test('brief rendering preserves evidence links, uncertainty and escaped source text',async()=>{
  const a=withApex();const mock=client([a,review(a)]);
  const {brief}=await runResearch(input,mock.api,undefined,dependencies);
  brief.owner_notes='<script>alert("bad")</script>';
  const html=renderToStaticMarkup(React.createElement(EvidenceBriefContent,{data:brief,schoolName:input.schoolName,location:input.location,franchiseeName:'Example Owner'}));
  assert.match(html,/href="#evidence-F2"/);assert.match(html,/id="evidence-F2"/);
  assert.match(html,/needs.*hypothesis|hypothesis.*school confirms/is);assert.match(html,/Research coverage/);
  assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
});
