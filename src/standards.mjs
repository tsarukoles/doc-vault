import { sha256, relativePath } from './security.mjs';
import { notePath } from './render.mjs';

export const CATEGORIES = ['general','languages/python','languages/javascript','languages/typescript','testing','cicd','databases','transformations'];
export const RESULTS = ['complies','diverges','noncompliant','unknown','not-applicable'];
export const START = '<!-- doc-vault:standards:start -->';
export const END = '<!-- doc-vault:standards:end -->';
const plain = value => String(value ?? '').replace(/[\r\n]+/g,' ').replace(/[<>]/g,'').replace(/([\\`*_[\]#|])/g,'\\$1');
const wiki = (target,label) => `[[${target.replace(/\.md$/,'')}|${String(label).replace(/[\[\]|\r\n]/g,' ')}]]`;
const table = (rows,headers=['Standard','Basis','Result','Explanation']) => `${headers.join(' | ')}\n--- | --- | --- | ---\n${rows.map(row=>row.map(cell=>String(cell).replace(/(?<!\\)\|/g,'\\|')).join(' | ')).join('\n')}\n`;
const front = (title,body,time) => `---\ntype: standards\nanalysis_level: derived\nupdated_at: ${JSON.stringify(time)}\n---\n\n# ${title}\n\n${body}\n\n[[standards/index|Standards]] · [[index|Vault index]]\n`;

export function validateScope(scope) {
  if(!scope||typeof scope!=='object'||Array.isArray(scope)||Object.keys(scope).some(k=>!['languages','kinds','paths'].includes(k))) throw new Error('A scope requires languages, kinds, and/or paths.');
  const out={};
  for(const key of ['languages','kinds','paths']) {
    const values=scope[key];
    if(!Array.isArray(values)||values.length>100)throw new Error('Invalid standards scope.');
    out[key]=[...new Set(values.map(v=>key==='paths'&&typeof v==='string'?v.replace(/\/$/,''):v))].sort();
    for(const value of out[key]) {
      if(typeof value!=='string'||!value||value.length>300)throw new Error('Invalid standards scope value.');
      if(key==='paths') {relativePath(value);if(/[*?]/.test(value))throw new Error('Scope paths are exact paths or prefixes, not globs.');}
      else if(!/^[a-z0-9][a-z0-9-]*$/.test(value))throw new Error('Use lowercase language/kind identifiers.');
    }
  }
  return out;
}

export function applies(rule,record) {
  const s=rule.scope;
  return !Object.values(s).some(a=>a.length)||s.languages.includes(record.language)||s.kinds.includes(record.kind)||s.paths.some(p=>record.path===p||record.path.startsWith(`${p}/`));
}

export function makeRule(input) {
  if(typeof input.id!=='string'||!/^[a-z][a-z0-9-]{1,79}$/.test(input.id)||!CATEGORIES.includes(input.category))throw new Error('Use a stable rule id and a supported standards category.');
  const scope=validateScope(input.scope);
  const identity={id:input.id,category:input.category,title:input.title,requirement:input.requirement,rationale:input.rationale,verification:input.verification,scope,authority:input.authority,evidence:input.evidence||[],references:input.references||[],catalog_version:input.catalog_version||null};
  return {...identity,hash:sha256(JSON.stringify(identity)),note_path:`standards/${input.category}/${input.id}.md`,freshness:input.freshness||'current',registered_at:input.registered_at};
}

const evidenceCurrent=(evidence,records)=>evidence.every(e=>records.some(r=>r.path===e.path&&r.sha256===e.sha256&&['included','reference'].includes(r.status)));
export function assessmentCurrent(a,rule,record,records,relations=[]) {
  if(!a||a.source_hash!==record.sha256||a.rule_hash!==rule.hash||rule.freshness!=='current'||!evidenceCurrent(a.evidence,records)||!a.dependencies)return false;
  if(!a.dependencies.every(d=>records.some(r=>r.path===d.path&&r.sha256===d.sha256&&r.status===d.status)))return false;
  const connected=new Set(a.dependencies.map(d=>d.path));
  const neighborhood=sha256(JSON.stringify(relations.filter(rel=>connected.has(rel.from)||connected.has(rel.to)).map(rel=>JSON.stringify(rel)).sort()));
  return a.neighborhood===neighborhood;
}

export function reconcileStandards(previous,records,catalog,now) {
  const rules={};
  for(const input of catalog.rules) {
    const rule=makeRule({...input,scope:input.applies_to,authority:'advisory',catalog_version:catalog.version});
    rules[rule.id]={...rule,registered_at:previous?.rules?.[rule.id]?.hash===rule.hash?previous.rules[rule.id].registered_at:now};
  }
  for(const rule of Object.values(previous?.rules||{}).filter(r=>r.authority!=='advisory')) {
    if(rules[rule.id])throw new Error(`Custom rule conflicts with a bundled rule: ${rule.id}`);
    rules[rule.id]={...rule,freshness:evidenceCurrent(rule.evidence,records)?'current':'stale'};
  }
  const assessments={};
  for(const record of records.filter(r=>r.status==='included')) {
    const old=previous?.assessments?.[record.path];
    if(!old)continue;
    assessments[record.path]={};
    for(const [id,item] of Object.entries(old))if(rules[id]&&applies(rules[id],record))assessments[record.path][id]=item;
  }
  return {catalog_version:catalog.version,rules,assessments};
}

export function standardsFingerprint(standards) {
  return sha256(JSON.stringify(Object.values(standards?.rules||{}).map(r=>[r.id,r.hash,r.freshness]).sort((a,b)=>a[0].localeCompare(b[0]))));
}

export function fileStandards(state,record) {
  return Object.values(state.standards?.rules||{}).filter(rule=>applies(rule,record)).sort((a,b)=>a.id.localeCompare(b.id)).map(rule=>{
    const item=state.standards.assessments?.[record.path]?.[rule.id];
    const current=assessmentCurrent(item,rule,record,state.records,state.analysis?.relations||[]);
    return {rule,assessment:item?{...item,freshness:current?'current':'stale',result:current?item.result:'not-assessed',previous_result:current?undefined:item.result}:{result:'not-assessed',freshness:rule.freshness==='current'?'unassessed':'stale'}};
  });
}

export function standardsCoverage(state) {
  const counts={files:0,candidates:0,assessed:0,stale:0,'not-assessed':0};
  for(const record of state.records.filter(r=>r.status==='included')) {
    counts.files++;
    for(const {assessment} of fileStandards(state,record)) {
      counts.candidates++;
      if(assessment.result==='not-assessed')counts['not-assessed']++;
      else {counts.assessed++;counts[assessment.result]=(counts[assessment.result]||0)+1;}
      if(assessment.freshness==='stale')counts.stale++;
    }
  }
  return counts;
}

function describeAssessment(a) {
  if(a.freshness==='stale')return `Stale: re-assess against current source and policy. Previous result: ${plain(a.previous_result||'unavailable')}.`;
  if(a.result==='not-assessed')return 'Source inspection has not assessed this candidate rule.';
  return `${plain(a.rationale)} Assessed ${plain(a.assessed_at)}; method: source inspection. ${a.evidence.map(e=>`${plain(e.path)}${e.start_line?`:${e.start_line}-${e.end_line}`:e.selector?.sheet?` [${plain(e.selector.sheet)}]`:' [workbook]'}`).join('; ')}.`;
}

export function withStandards(content,state,record) {
  const start=content.indexOf(START),end=content.indexOf(END);
  if(start!==-1) {
    if(end<start)throw new Error('Malformed managed standards section.');
    content=content.slice(0,start)+content.slice(end+END.length);
  }
  const rows=fileStandards(state,record).map(({rule,assessment})=>[wiki(rule.note_path,rule.title),plain(rule.authority),plain(assessment.result),describeAssessment(assessment)]);
  return `${content.trimEnd()}\n\n${START}\n## Coding standards\n\n${table(rows)}\nThese results describe cited, bounded source inspection. They are not runtime validation or a certification of the whole file. A candidate rule may be marked not-applicable with evidence. [[standards/index|Rule catalog and interpretation]]\n${END}\n`;
}

export function renderStandards(state) {
  const output={},rules=Object.values(state.standards.rules).sort((a,b)=>a.id.localeCompare(b.id)),records=state.records.filter(r=>r.status==='included');
  const byFile=new Map(records.map(r=>[r.path,fileStandards(state,r)]));
  const times=[state.snapshot.created_at,...rules.map(r=>r.registered_at),...Object.values(state.standards.assessments).flatMap(a=>Object.values(a).map(v=>v.assessed_at))].filter(Boolean).sort();
  const now=times.at(-1);
  const grouped={};
  for(const rule of rules) {
    const entries=records.filter(r=>applies(rule,r));
    const backlinks=entries.map(r=>{
      const a=byFile.get(r.path).find(e=>e.rule.id===rule.id).assessment;
      return `- ${wiki(notePath(r.path),r.path)} — ${a.result}${a.freshness==='stale'?' (stale)':''}.`;
    }).join('\n')||'No included file matches this scope.';
    const authority=rule.evidence.map(e=>`- ${plain(e.path)}${e.start_line?`:${e.start_line}-${e.end_line}`:e.selector?.sheet?` [${plain(e.selector.sheet)}${e.selector.cell?`!${plain(e.selector.cell)}`:''}]`:' [workbook structure]'} · SHA-256 \`${e.sha256}\``).join('\n');
    const refs=rule.references.map(r=>`- [${plain(r.title)}](${r.url}) (reference accessed ${plain(r.accessed_at)}).`).join('\n');
    const ruleTime=[state.snapshot.created_at,rule.registered_at,...entries.map(r=>state.standards.assessments?.[r.path]?.[rule.id]?.assessed_at)].filter(Boolean).sort().at(-1);
    output[rule.note_path]=front(rule.title,`Basis: **${rule.authority}**. Policy evidence: **${rule.freshness}**. Rule fingerprint: \`${rule.hash}\`.\n\n## Guidance\n\n${plain(rule.requirement)}\n\n${plain(rule.rationale)}\n\n## How to inspect\n\n${plain(rule.verification)}\n\nScope candidates (any match): languages ${plain(rule.scope.languages.join(', ')||'none')}; kinds ${plain(rule.scope.kinds.join(', ')||'none')}; paths ${plain(rule.scope.paths.join(', ')||'none')}. Empty scope matches all included files. A filename match is not proof of applicability.\n\n## Authority and references\n\n${authority||'This is bundled advisory guidance, not an adopted project requirement.'}\n\n${refs}\n\n## Related files\n\n${backlinks}`,ruleTime);
    (grouped[rule.category]??=[]).push(`- ${wiki(rule.note_path,rule.title)} — ${rule.authority}; ${rule.freshness}.`);
  }
  for(const [category,links] of Object.entries(grouped))output[`standards/${category}/index.md`]=front(category,links.join('\n'),[state.snapshot.created_at,...rules.filter(r=>r.category===category).map(r=>r.registered_at)].sort().at(-1));
  const coverage=standardsCoverage(state);
  output['standards/index.md']=front('Coding standards',`The catalog separates explicit project requirements (**declared**), observed practices (**convention**), and external recommendations (**advisory**). Only a current declared requirement can produce noncompliant. Neither a common style nor a bundled recommendation is automatically mandatory.\n\n${Object.entries(grouped).map(([category])=>`- ${wiki(`standards/${category}/index.md`,category)}`).join('\n')}\n\n## Results\n\n- **complies:** the cited implementation satisfies the inspected rule within the stated scope.\n- **diverges:** an observed practice differs from guidance, or a documented permitted exception needs explanation.\n- **noncompliant:** evidence contradicts an explicit applicable project requirement.\n- **unknown:** available evidence cannot settle the result, including conflicting requirements.\n- **not-applicable:** inspected behavior is outside the rule; explanation and evidence are required.\n- **not-assessed:** no current assessment exists. A stale result is kept in structured history but is not displayed as current compliance.\n\n${coverage.assessed} current assessments out of ${coverage.candidates} file/rule candidates; ${coverage.stale} stale. ${wiki('reports/standards-coverage.md','Assessment coverage')}. Each rule links back to its candidate files.\n\nNo cloud calls, builds, tests, or source execution were performed. External references are attribution; the runtime does not fetch them.`,now);
  output['reports/standards-coverage.md']=front('Standards assessment coverage',`Included files: ${coverage.files}. Rule/file candidates: ${coverage.candidates}. Current assessments: ${coverage.assessed}. Not assessed: ${coverage['not-assessed']}. Stale: ${coverage.stale}.\n\n${table(records.map(r=>{
    const entries=byFile.get(r.path),pending=entries.filter(e=>e.assessment.result==='not-assessed').length;
    return [wiki(notePath(r.path),r.path),`${entries.length} candidate rules`,`${entries.length-pending} assessed`,`${pending} need assessment`];
  }),['File','Candidates','Assessed','Pending'])}\nCoverage counts inspections, not code correctness. Read rationale, evidence, applicability, and limitations before using a result.`,now);
  return output;
}
