import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cleanUrl, publicAddress } from '../lib/research/network';
import { extractHtml, extractPdf, rankLink, selectPassages } from '../lib/research/reader';
import { normalizeFacebookUrl, selectPosts } from '../lib/research/social';
import { validateFacts, dateSupported, deriveNeeds, draftGate, sourceCoverage } from '../lib/research/validate';
import { evidenceContext } from '../lib/research/prompts';
import { analysis, input, page, withApex } from './fixtures/school';

const now=new Date('2026-09-22T12:00:00Z');
test('public URL validation rejects internal hosts, private IPs, credentials and non-web protocols',()=>{
  for(const u of ['http://localhost/a','http://127.0.0.1','http://[::1]','http://169.254.169.254/','http://10.0.0.3','http://[::ffff:127.0.0.1]','https://school.local','https://user:pass@school.org','javascript:alert(1)','https://school.org:8080'])assert.equal(cleanUrl(u),null,u);
  assert.equal(publicAddress('192.168.2.1'),false);assert.equal(publicAddress('8.8.8.8'),true);
});
test('URL cleanup preserves document and Facebook identity parameters',()=>{
  assert.equal(cleanUrl('https://school.org/events?id=2&utm_source=email#top'),'https://school.org/events?id=2');
  assert.equal(normalizeFacebookUrl('https://www.facebook.com/profile.php?id=123456789&utm_source=x'),'https://www.facebook.com/profile.php?id=123456789');
  assert.equal(normalizeFacebookUrl('https://www.facebook.com/p/Cedar-PTO-123456789/'),'https://www.facebook.com/123456789');
  assert.equal(normalizeFacebookUrl('https://facebook.com.evil.org/profile.php?id=123'),null);
});
test('HTML extraction finds linked officer documents and excludes footer years',()=>{
  const p=extractHtml('<html><head><title>PTO</title></head><body><nav><a href="/officers">Officers</a></nav><main><p>Apex Fun Run October 16, 2025.</p><a href="/files/budget.pdf">PTSO budget</a></main><footer>2026-2027 school calendar</footer></body></html>','https://school.org/pto');
  assert.match(p.text,/October 16, 2025/);assert.doesNotMatch(p.text,/2026-2027/);
  assert.ok(p.links.some(l=>l.url==='https://school.org/officers'&&rankLink(l)>0));
  assert.ok(p.links.some(l=>l.url.endsWith('budget.pdf')&&rankLink(l)>0));
});
test('a text PDF is actually extracted, including financial scope',async()=>{
  const bytes=await readFile(new URL('./fixtures/pto-budget.pdf',import.meta.url));
  const text=await extractPdf(new Uint8Array(bytes));
  assert.match(text,/Cedar Grove PTO/);assert.match(text,/25,000/);assert.match(text,/goal/i);
});
test('passage selection finds a relevant detail beyond the old 6,000 character cutoff',()=>{
  const text='Welcome to our community. '.repeat(600)+'\nThe PTO fundraiser goal is $25,000 for playground equipment.\n';
  assert.match(selectPassages(text,4000),/fundraiser goal/);
});
test('past spring and long-body social signals are retained; undated chatter is not recent',()=>{
  const posts=selectPosts([
    {text:'x'.repeat(650)+' Apex fundraiser recap',time:'2026-04-10',url:'https://facebook.com/1/posts/2'},
    {text:'Undated routine hello'},
    {text:'Undated volunteer recruitment'},
    {text:'Recent school update',time:'2026-09-20'},
    {text:'Old fundraiser',time:'2022-04-01'},
  ],now);
  assert.equal(posts.length,3);assert.ok(posts.some(p=>p.text.includes('Apex fundraiser')));
  assert.ok(posts.some(p=>p.text==='Undated volunteer recruitment'&&p.date===null));
  assert.ok(!posts.some(p=>p.text==='Undated routine hello'));
});
test('date validation requires the actual year and rejects impossible calendar dates',()=>{
  assert.equal(dateSupported('2025-10-16','October 16, 2025'),true);
  assert.equal(dateSupported('2026-10-16','October 16, 2025'),false);
  assert.equal(dateSupported('2025-10-16','October 16. Copyright 2025'),false);
  assert.equal(dateSupported('2026-02-30','2026-02-30'),false);
});
test('old Apex activity stays historical; an invented school year cannot be confirmed',()=>{
  const a=withApex();a.facts[3].school_year='2026-2027';a.facts[3].currency='current';
  const {facts}=validateFacts(a,[page],now);const f=facts[3];
  assert.equal(f.currency,'historical');assert.equal(f.school_year,null);assert.equal(f.support,'unclear');
});
test('invalid quotations, search snippets, other campuses and duplicate IDs are excluded',()=>{
  const a=structuredClone(analysis);
  a.facts.push({...a.facts[0],id:'bad-quote',excerpt:'An invented passage that is not on this page.'});
  a.facts.push({...a.facts[0],id:'other-campus',campus_match:'no'});
  a.facts.push({...a.facts[0]});
  assert.equal(validateFacts(a,[page],now).rejected.length,3);
  assert.equal(validateFacts(analysis,[{...page,status:'snippet_only'}],now).facts.length,0);
});
test('routine recruitment remains tentative after fact review; no evidence means no need',()=>{
  const {facts}=validateFacts(analysis,[page],now);facts.forEach(f=>f.support='reviewed');
  assert.equal(deriveNeeds(analysis,facts)[0].confidence,'tentative');
  assert.equal(deriveNeeds(analysis,[]).length,0);
});
test('money retains parent organization and goal labels instead of becoming annual school revenue',()=>{
  const f=validateFacts(analysis,[page],now).facts[2];
  assert.equal(f.amount_scope,'parent_organization');assert.equal(f.amount_type,'goal');
});
test('cold drafts are held for public Apex history and ambiguous grade scope',()=>{
  const facts=validateFacts(withApex(),[page],now).facts;
  assert.equal(draftGate(input,'elementary',facts).allowed,false);
  assert.equal(draftGate({...input,relationship:'current'},'elementary',facts).allowed,true);
  assert.equal(draftGate({...input,relationship:'former',gradeScope:'unknown'},'mixed',facts).allowed,false);
  assert.equal(draftGate(input,'elementary',[]).allowed,false);
});
test('unavailable source coverage is visible and missing pages are not evidence of absence',()=>{
  const coverage=sourceCoverage([{...page,status:'blocked',category:'Budgets and minutes'}]);
  assert.equal(coverage.find(c=>c.area==='Budgets and minutes')?.status,'unavailable');
  assert.match(coverage.find(c=>c.area==='People and capacity')!.detail,/does not establish absence/);
});
test('late social evidence receives prompt space even when early sources are very long',()=>{
  const pages=Array.from({length:28},(_,i)=>({...page,id:`S${i+1}`,text:'School facts and notes. '.repeat(4500)}));
  pages.push({...page,id:'S29',text:'Unique social clue: cancelled fair due to unfilled volunteer roles.'});
  const context=evidenceContext(pages);
  assert.match(context,/Unique social clue/);assert.ok(context.length<190000);
});
