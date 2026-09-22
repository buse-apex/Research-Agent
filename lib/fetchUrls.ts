// Shared URL input normalization for the research and meeting-check forms.
// Content retrieval for v39 lives in research/reader.ts and research/network.ts.
import { cleanUrl } from './research/network';
export function sanitizeUrls(raw:unknown):string[]{
  const values=Array.isArray(raw)?raw.map(String):typeof raw==='string'?raw.split(/[\n,]+/):[];
  return [...new Set(values.map(s=>{const t=s.trim();return t?cleanUrl(/^https?:\/\//i.test(t)?t:'https://'+t):null;}).filter((x):x is string=>!!x))].slice(0,5);
}
