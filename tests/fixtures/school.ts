import type { Analysis, Page } from '../../lib/research/types';
import { InputSchema } from '../../lib/research/types';

// Synthetic school and people. These are regression fixtures, not live findings.
export const input=InputSchema.parse({schoolName:'Cedar Grove School',location:'Example City, NC',gradeScope:'elementary'});
export const page:Page={id:'S1',url:'https://school.example.org/pto',title:'Cedar Grove PTO',kind:'html',status:'read',accessed_at:'2026-09-22T12:00:00Z',published_at:null,category:'School and parent organization',links:[],text:[
  'Cedar Grove School serves kindergarten through fifth grade.',
  'Volunteers are welcome to help at the spring fair.',
  'The PTO fundraising goal is $25,000 for playground equipment.',
  'On October 16, 2025, Cedar Grove hosted an Apex Fun Run.',
  'PTO president: Alex Example.',
].join('\n')};
const common={source_id:'S1',entity:'Cedar Grove School PTO',campus_match:'yes' as const,event_date:null,school_year:null,currency:'undated' as const,amount_scope:'not_applicable' as const,amount_type:'not_applicable' as const};
export const analysis:Analysis={
  school_identity:{name:'Cedar Grove School',grade_span:'K-5',district:'Not established',address:''},
  facts:[
    {...common,id:'F1',claim:'Cedar Grove serves K-5.',excerpt:page.text.split('\n')[0],category:'identity'},
    {...common,id:'F2',claim:'The PTO invites volunteers to the spring fair.',excerpt:page.text.split('\n')[1],category:'capacity'},
    {...common,id:'F3',claim:'The PTO lists a $25,000 playground fundraising goal.',excerpt:page.text.split('\n')[2],category:'money',amount_scope:'parent_organization',amount_type:'goal'},
  ],
  needs:[{need:'workload',hypothesis:'The PTO may want help with event delivery.',job_to_be_done:'When planning an event, help us cover the work so we can deliver it with available volunteers.',evidence_ids:['F2'],counterevidence_ids:[],alternative_explanation:'Recruitment may be routine; capacity may be sufficient.',question:'How manageable was the work for your team last time?',message_direction:'Explore workload before proposing support.',proof_to_bring:'A clear division of responsibilities.'}],
  people:[],apex_history_ids:[],grade_scope:'elementary',gaps:['Volunteer capacity is unconfirmed.'],
};
export function withApex():Analysis{
  const a=structuredClone(analysis);
  a.facts.push({...common,id:'F4',claim:'Cedar Grove hosted Apex on October 16, 2025.',excerpt:page.text.split('\n')[3],category:'fundraiser',event_date:'2025-10-16',currency:'historical'});
  a.apex_history_ids=['F4'];return a;
}
