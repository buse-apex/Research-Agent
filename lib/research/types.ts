export type Page = {
  id: string; url: string; title: string; kind: 'html'|'pdf'|'social'|'snippet';
  status: 'read'|'blocked'|'failed'|'unsupported'|'snippet_only'; text: string;
  accessed_at: string; published_at: string|null; links: {url:string;label:string}[];
  reason?: string; truncated?: boolean; category: string;
};
