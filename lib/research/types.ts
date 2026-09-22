import { z } from 'zod';

export const InputSchema = z.object({
  schoolName: z.string().trim().min(1).max(120), location: z.string().trim().min(1).max(120),
  franchiseeName: z.string().trim().max(120).default(''), extraUrls: z.union([z.string(), z.array(z.string())]).optional(),
  includeSocial: z.boolean().default(false),
  relationship: z.enum(['unknown','prospect','current','former']).default('unknown'),
  gradeScope: z.enum(['unknown','elementary','middle','mixed','high']).default('unknown'),
  ownerNotes: z.string().trim().max(3000).default(''),
});
export type ResearchInput = z.infer<typeof InputSchema>;
export const NeedName = z.enum(['workload','funding_goal','value','participation','school_day','other']);
export const FactSchema = z.object({
  id: z.string().max(40), claim: z.string().max(1200), source_id: z.string(), excerpt: z.string().min(12).max(1800),
  category: z.enum(['identity','people','fundraiser','money','capacity','participation','school_day','timing','other']),
  entity: z.string().max(200), campus_match: z.enum(['yes','uncertain','no']),
  event_date: z.string().nullable(), school_year: z.string().nullable(),
  currency: z.enum(['current','historical','undated']),
  amount_scope: z.enum(['school_organization','parent_organization','specific_event','not_applicable','unknown']),
  amount_type: z.enum(['goal','gross','net','expense','not_applicable','unknown']),
});
export type Fact = z.infer<typeof FactSchema> & { support: 'source_matched'|'reviewed'|'unclear'|'contradicted'; warnings: string[] };
export const AnalysisSchema = z.object({
  school_identity: z.object({ name: z.string(), grade_span: z.string(), district: z.string(), address: z.string() }),
  facts: z.array(FactSchema).max(35),
  needs: z.array(z.object({
    need: NeedName, hypothesis: z.string(), job_to_be_done: z.string(),
    evidence_ids: z.array(z.string()), counterevidence_ids: z.array(z.string()),
    alternative_explanation: z.string(), question: z.string(), message_direction: z.string(), proof_to_bring: z.string(),
  })).max(6),
  people: z.array(z.object({ name: z.string(), role: z.string(), evidence_ids: z.array(z.string()), tenure: z.string(), question: z.string() })).max(12),
  apex_history_ids: z.array(z.string()),
  grade_scope: z.enum(['elementary','middle','mixed','high','unknown']),
  gaps: z.array(z.string()).max(12),
});
export type Analysis = z.infer<typeof AnalysisSchema>;
export type Page = {
  id: string; url: string; title: string; kind: 'html'|'pdf'|'social'|'snippet';
  status: 'read'|'blocked'|'failed'|'unsupported'|'snippet_only'; text: string;
  accessed_at: string; published_at: string|null; links: {url:string;label:string}[];
  reason?: string; truncated?: boolean; category: string;
};
export type Coverage = { area:string; status:'read'|'partial'|'not_found'|'unavailable'|'not_requested'; detail:string };
export type Need = Analysis['needs'][number] & { confidence:'supported_hypothesis'|'tentative'; state:'hypothesis' };
export type Draft = { type:string;subject:string;body:string;evidence_ids:string[] };
export type BriefV2 = {
  schema_version:2; generated_at:string; school_identity:Analysis['school_identity'];
  relationship:{status:ResearchInput['relationship'];basis:string;public_apex_history:boolean;check_required:boolean};
  grade_scope:Analysis['grade_scope']; facts:Fact[]; needs:Need[]; people:Analysis['people'];
  gaps:string[]; next_steps:string[]; emails:Draft[]; draft_note:string;
  coverage:Coverage[]; sources:Omit<Page,'text'|'links'>[]; verification_summary:string;
  owner_notes:string; input_context:{relationship:ResearchInput['relationship'];gradeScope:ResearchInput['gradeScope']};
};
export const LABELS:Record<string,string>={workload:'Reduce workload',funding_goal:'Reach a funding goal',value:'Make the cost worthwhile',participation:'Build participation',school_day:'Protect the school day',other:'Another need'};
