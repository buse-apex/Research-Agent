// Offline format preview. Does not contact any model, school or provider.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mkdir, writeFile } from 'node:fs/promises';
import { EvidenceBriefContent, printCss } from '../components/EvidenceBrief';
import { analysis, input, page } from '../tests/fixtures/school';
import { validateFacts, deriveNeeds, sourceCoverage } from '../lib/research/validate';
import type { BriefV2 } from '../lib/research/types';

async function main(){
  const facts=validateFacts(analysis,[page],new Date('2026-09-22T12:00:00Z')).facts;
  const {text,links,...source}=page;
  const brief:BriefV2={schema_version:2,generated_at:page.accessed_at,school_identity:analysis.school_identity,
    relationship:{status:'unknown',basis:'Fictional format example; no owner relationship supplied.',public_apex_history:false,check_required:false},grade_scope:'elementary',facts,needs:deriveNeeds(analysis,facts),people:[],gaps:analysis.gaps,
    next_steps:['Confirm whether the playground goal is still active.','Ask how manageable the event workload was last time.','Confirm who owns fundraising and approvals.'],
    emails:[{type:'Illustrative introduction',subject:'Playground plans',body:'Hi [name],\n\nYour PTO page lists a playground funding goal. Is that still a priority for the team?\n\nI work with local schools through Apex, a two-week fundraising program with a local team. Before suggesting an approach, I would like to understand what you need the fundraiser to accomplish and how the work fits around your volunteers and school day.\n\nWould you be open to a short conversation about what you want from your next fundraiser?\n\n[Your name]',evidence_ids:['F3']}],
    draft_note:'Illustrative text based on fictional fixtures. Not a live, reviewed or ready-to-send school email.',coverage:[...sourceCoverage([page]),{area:'Public social posts',status:'not_requested',detail:'Not used in this offline example.'},{area:'Claim review',status:'not_requested',detail:'No model/provider was called to create this format preview.'}],sources:[source],verification_summary:'Fictional fixture quotations matched locally. No independent model review or live school research was performed.',owner_notes:'Sample owner context would appear here, separate from public evidence.',input_context:{relationship:'unknown',gradeScope:'elementary'}};
  const body=renderToStaticMarkup(React.createElement(EvidenceBriefContent,{data:brief,schoolName:input.schoolName,location:input.location,franchiseeName:'Example Owner'})).replaceAll('<details ','<details open ');
  const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fictional sample | Apex research brief</title><style>'+printCss+'</style></head><body><aside class="eb-warning"><b>FICTIONAL FORMAT EXAMPLE</b><p>This school, evidence and draft are synthetic. This is a preview of the new brief layout, not a live research result.</p></aside>'+body+'</body></html>';
  await mkdir('examples',{recursive:true});
  await writeFile('examples/sample-brief.html',html);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
