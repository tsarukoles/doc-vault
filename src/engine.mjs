import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { sha256, rootDirectory, relativePath, validateVaultName, checkedPath, readBytes, makeDirectory, writeAtomic, removeOwnedFile, ensureIgnore } from './security.mjs';
import { inventory, identityAndChanges, stripContent, inventoryDigest, gitState, assertUntrackedVault, ignoreDiagnostics } from './inventory.mjs';
import { analyzeRepository } from './analyze.mjs';
import { renderVault, notePath, renderAnalysisIndex } from './render.mjs';
import { inspectWorkbook } from './readers.mjs';
import { makeRule, reconcileStandards, standardsFingerprint, fileStandards, standardsCoverage, renderStandards, withStandards, applies, RESULTS, START, END } from './standards.mjs';

export const PACKAGE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const VERSION = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT,'package.json'),'utf8')).version;
const SCHEMA_VERSION=1;
const STATES=['included','reference'];
const noChanges=changes=>!Object.values(changes).some(values=>values.length);
const textValue=(value,max=16000)=>{
  if(typeof value!=='string'||value.length>max||value.includes('\0')) throw new Error('Invalid or oversized text field.');
  if(/<\/?[a-z][^>]*>|!\[/i.test(value)) throw new Error('Raw HTML and image embeds are not allowed in generated notes.');
  if(value.includes(START)||value.includes(END))throw new Error('Managed standards markers cannot be supplied by the model.');
  return value;
};
const yaml=value=>JSON.stringify(value).replace(/\[/g,'\\u005b').replace(/\]/g,'\\u005d');

function noteLinks(text) {
  const prose=text.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/,'').replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm,'').replace(/(`+)[^\n]*?\1/g,'');
  return [...prose.matchAll(/\[\[([^\]\n]+)\]\]/g)].map(match=>match[1].split(/\\?\|/)[0].split('#')[0]).filter(Boolean);
}

export async function createEngine(target,{vaultName='edw-doc'}={}) {
  const root=rootDirectory(target);
  validateVaultName(vaultName);
  const vault=()=>checkedPath(root,vaultName,{allowMissing:true,write:true});
  const vaultFile=(relative,allowMissing=false)=>checkedPath(vault(),relative,{allowMissing,write:true});
  const statePath='.system/state.json';
  const catalog=()=>JSON.parse(readBytes(PACKAGE_ROOT,'packs/standards/catalog.json',512*1024).toString('utf8'));
  const readState=()=>{
    if(!fs.existsSync(vault()) || !fs.existsSync(vaultFile(statePath,true))) return null;
    const state=JSON.parse(readBytes(vault(),statePath,64*1024*1024).toString('utf8'));
    if(state.schema_version!==SCHEMA_VERSION) throw new Error('Unsupported vault schema. Use a compatible plugin version; no files were migrated.');
    return state;
  };
  const writeState=state=>writeAtomic(vault(),statePath,JSON.stringify(state,null,2)+'\n');
  const requireState=()=>{
    const state=readState();
    if(!state) throw new Error('Initialize this repository with vault_scan or the scan command first.');
    return state;
  };
  function assertVaultOwnership() {
    const absolute=vault();
    if(fs.existsSync(absolute)) {
      if(!fs.lstatSync(absolute).isDirectory()) throw new Error('Vault path is not an ordinary directory.');
      const items=fs.readdirSync(absolute);
      if(items.length && !fs.existsSync(vaultFile('.system/owner.json',true))) throw new Error('Existing nonempty directory is not a Doc Vault. Refusing to adopt or overwrite it.');
      if(fs.existsSync(vaultFile('.system/owner.json',true))) {
        const owner=JSON.parse(readBytes(absolute,'.system/owner.json').toString('utf8'));
        if(owner.product!=='doc-vault') throw new Error('Unrecognized vault ownership marker.');
      }
    }
    assertUntrackedVault(root,vaultName);
  }
  function initialize() {
    if(vaultName==='edw-doc'&&!fs.existsSync(vault())) {
      const legacy=checkedPath(root,'doc-vault',{allowMissing:true});
      if(fs.existsSync(legacy)&&fs.lstatSync(legacy).isDirectory()&&fs.existsSync(checkedPath(legacy,'.system/owner.json',{allowMissing:true}))) {
        const marker=JSON.parse(readBytes(legacy,'.system/owner.json',8192).toString('utf8'));
        if(marker.product==='doc-vault')throw new Error('An existing doc-vault/ needs explicit migration to edw-doc/. Use the CLI migrate command, or DOC_VAULT_NAME=doc-vault to keep that vault.');
      }
    }
    assertVaultOwnership();
    // Check the exceptional write before creating the vault.
    checkedPath(root,'.gitignore',{allowMissing:true,write:true});
    ensureIgnore(root,vaultName);
    makeDirectory(root,vaultName);
    makeDirectory(vault(),'.system');
    if(!fs.existsSync(vaultFile('.system/owner.json',true))) writeAtomic(vault(),'.system/owner.json',JSON.stringify({product:'doc-vault',schema_version:SCHEMA_VERSION})+'\n');
  }
  async function locked(action,{init=false}={}) {
    if(init) initialize(); else {assertVaultOwnership();requireState();}
    const lockRelative='.system/write-lock.json';
    const lock=vaultFile(lockRelative,true);
    if(fs.existsSync(lock)) {
      const owner=JSON.parse(readBytes(vault(),lockRelative,8192).toString('utf8'));
      let active=true;
      if(owner.host===os.hostname() && Number.isInteger(owner.pid)) {
        try {process.kill(owner.pid,0);} catch(error) {if(error.code==='ESRCH') active=false;}
      }
      if(active) throw new Error('Another vault writer is active, or its lock needs inspection.');
      removeOwnedFile(vault(),lockRelative);
    }
    const token=crypto.randomBytes(12).toString('hex');
    fs.writeFileSync(lock,JSON.stringify({pid:process.pid,host:os.hostname(),token,created_at:new Date().toISOString()}),{flag:'wx',mode:0o600});
    try {return await action();}
    finally {
      if(fs.existsSync(vaultFile(lockRelative,true))) {
        const owner=JSON.parse(readBytes(vault(),lockRelative,8192).toString('utf8'));
        if(owner.token===token) removeOwnedFile(vault(),lockRelative);
      }
    }
  }
  const summary=records=>records.reduce((counts,r)=>(counts[r.status]=(counts[r.status]||0)+1,counts),{});
  function currentRecords(previous) {
    const records=inventory(root,vaultName);
    const changes=identityAndChanges(records,previous?.records||[]);
    return {records,changes};
  }
  function assertCurrent(state) {
    const check=currentRecords(state);
    if(inventoryDigest(check.records)!==state.snapshot.source_digest||state.version!==VERSION||gitState(root).head!==state.snapshot.head||fs.existsSync(vaultFile('.system/pending.json',true))||standardsFingerprint(reconcileStandards(state.standards,check.records,catalog(),state.snapshot.created_at))!==standardsFingerprint(state.standards)) throw new Error('Refresh the changed repository, standards, or pending publication before publishing or reviewing analysis.');
  }
  function currentSource(sourcePath,state) {
    relativePath(sourcePath);
    if(sourcePath===vaultName || sourcePath.startsWith(`${vaultName}/`)) throw new Error('The vault is never a source input.');
    if(sourcePath.split('/').includes('.claude'))throw new Error('Local Claude session metadata is excluded from source analysis.');
    const known=state.records.find(r=>r.path===sourcePath);
    if(!known || !STATES.includes(known.status)) throw new Error('Source is not an approved, inspected file. Scan first or consult coverage.');
    const bytes=readBytes(root,sourcePath,2*1024*1024);
    const hash=sha256(bytes);
    if(hash!==known.sha256) throw new Error('Source changed after the last scan. Refresh before reading or publishing evidence.');
    return {...known,bytes};
  }
  function evidenceCheck(evidence,state) {
    if(!Array.isArray(evidence)||!evidence.length||evidence.length>100) throw new Error('Each factual section needs 1–100 source evidence references.');
    return evidence.map(item=>{
      if(!item || typeof item!=='object') throw new Error('Invalid evidence reference.');
      const source=currentSource(item.path,state);
      if(item.sha256!==source.sha256) throw new Error('Evidence hash is missing or stale.');
      if(source.language==='xlsx') {
        const selector=item.selector;
        const book=inspectWorkbook(source.bytes);
        if(selector?.kind==='workbook'&&!selector.sheet&&!selector.cell) {
          if(!book.sheets.length)throw new Error('Workbook structure could not be inspected.');
          return {path:source.path,sha256:source.sha256,selector:{kind:'workbook'}};
        }
        if(!selector||typeof selector.sheet!=='string') throw new Error('Workbook evidence requires a sheet or workbook selector.');
        const sheet=book.sheets.find(s=>s.name===selector.sheet);
        if(!sheet) throw new Error('Workbook sheet was not inspected.');
        if(selector.cell && !sheet.cells?.some(c=>(typeof c==='string'?c:c.address||c.cell)===selector.cell)) throw new Error('Workbook cell was not present in the bounded inspection.');
        return {path:source.path,sha256:source.sha256,selector:{sheet:selector.sheet,...(selector.cell?{cell:selector.cell}:{})}};
      }
      const count=source.bytes.toString('utf8').split(/\r?\n/).length;
      if(!Number.isInteger(item.start_line)||!Number.isInteger(item.end_line)||item.start_line<1||item.end_line<item.start_line||item.end_line>count||item.end_line-item.start_line>500) throw new Error('Evidence line range is invalid or exceeds 501 lines.');
      return {path:source.path,sha256:source.sha256,start_line:item.start_line,end_line:item.end_line};
    });
  }
  function dependenciesFor(paths,state) {
    const dependencies=new Set(paths);
    let change=true;
    while(change) {
      change=false;
      for(const rel of state.analysis.relations||[]) {
        const resolve=id=>state.records.find(r=>r.id===id||r.path===id)?.path;
        const from=resolve(rel.from),to=resolve(rel.to);
        if(from&&to&&dependencies.has(from)&&!dependencies.has(to)) {dependencies.add(to);change=true;}
      }
    }
    return [...dependencies].map(p=>state.records.find(r=>r.path===p)).filter(Boolean).map(r=>({path:r.path,sha256:r.sha256,status:r.status}));
  }
  function neighborhood(paths,state) {
    const connected=new Set(paths);
    const relations=(state.analysis.relations||[]).filter(rel=>connected.has(rel.from)||connected.has(rel.to)).map(rel=>JSON.stringify(rel)).sort();
    return sha256(JSON.stringify(relations));
  }
  function checkLinks(content,known,ownPath) {
    const errors=[];
    for(const target of noteLinks(content)) {
      let normalized;
      try {normalized=relativePath(target.endsWith('.md')?target:`${target}.md`);} catch {errors.push(`Unsafe wiki link: ${target}`);continue;}
      if(normalized!==ownPath && !known.has(normalized)) errors.push(`Unresolved wiki link: ${target}`);
    }
    return errors;
  }
  function publishBatch(outputs,state,previous) {
    const known=new Set(Object.keys(outputs));
    for(const [note,content] of Object.entries(outputs)) {
      relativePath(note);
      if(!note.endsWith('.md')||note.startsWith('.system/')||note.startsWith('annotations/')) throw new Error('Renderer attempted to write outside managed Markdown destinations.');
      const errors=checkLinks(content,known,note);
      if(errors.length) throw new Error(`Generated link validation failed in ${note}: ${errors.slice(0,3).join('; ')}`);
      const absolute=vaultFile(note,true);
      if(fs.existsSync(absolute) && !previous?.generated?.[note]) throw new Error(`An unmanaged file occupies ${note}; refusing to overwrite it.`);
      if(fs.existsSync(absolute) && previous?.generated?.[note] && sha256(readBytes(vault(),note,4*1024*1024))!==previous.generated[note]) {
        throw new Error(`Managed note ${note} was edited outside the publisher. Preserve the changes in annotations/ before refreshing.`);
      }
    }
    state.generated=Object.fromEntries(Object.entries(outputs).map(([note,content])=>[note,sha256(content)]));
    writeAtomic(vault(),'.system/pending.json',JSON.stringify({snapshot:state.snapshot.id,phase:'publishing',started_at:new Date().toISOString(),outputs,state,previous_generated:previous?.generated||{}})+'\n');
    for(const [note,content] of Object.entries(outputs)) {
      if(previous?.generated?.[note]!==sha256(content)||!fs.existsSync(vaultFile(note,true))) writeAtomic(vault(),note,content);
    }
    for(const note of Object.keys(previous?.generated||{})) {
      if(known.has(note)) continue;
      const absolute=vaultFile(note,true);
      if(fs.existsSync(absolute)&&sha256(readBytes(vault(),note,4*1024*1024))===previous.generated[note]) removeOwnedFile(vault(),note);
      else if(fs.existsSync(absolute)) throw new Error(`Retired note ${note} contains manual changes; preserve it in annotations/.`);
    }
    writeState(state);
    removeOwnedFile(vault(),'.system/pending.json');
  }
  function publishUpdates(outputs,state,previousGenerated) {
    const known=new Set([...Object.keys(state.generated),...Object.keys(outputs)]);
    for(const [note,content] of Object.entries(outputs)) {
      if(checkLinks(content,known,note).length)throw new Error(`Generated update contains invalid links: ${note}`);
      if(fs.existsSync(vaultFile(note,true))&&sha256(readBytes(vault(),note,4*1024*1024))!==previousGenerated[note])throw new Error(`Managed note ${note} has manual edits; move them to annotations/.`);
      state.generated[note]=sha256(content);
    }
    const before=Object.fromEntries(Object.keys(outputs).filter(note=>previousGenerated[note]).map(note=>[note,previousGenerated[note]]));
    writeAtomic(vault(),'.system/pending.json',JSON.stringify({snapshot:state.snapshot.id,phase:'publishing',outputs,state,previous_generated:before})+'\n');
    for(const [note,content] of Object.entries(outputs))writeAtomic(vault(),note,content);
    writeState(state);
    removeOwnedFile(vault(),'.system/pending.json');
  }
  function recoverPublication() {
    if(!fs.existsSync(vaultFile('.system/pending.json',true)))return;
    const pending=JSON.parse(readBytes(vault(),'.system/pending.json',128*1024*1024).toString('utf8'));
    if(!pending.outputs||!pending.state||!pending.previous_generated)throw new Error('Unrecognized publication journal; inspect the vault state before recovery.');
    const keys=new Set(Object.keys(pending.state.generated));
    for(const [note,content] of Object.entries(pending.outputs)) {
      relativePath(note);
      if(!note.endsWith('.md')||note.startsWith('.system/')||note.startsWith('annotations/')||typeof content!=='string'||pending.state.generated[note]!==sha256(content))throw new Error('Invalid publication journal.');
      if(checkLinks(content,keys,note).length)throw new Error('Journal contains unresolved wiki links.');
      const absolute=vaultFile(note,true);
      if(fs.existsSync(absolute)) {
        const current=sha256(readBytes(vault(),note,4*1024*1024));
        if(current!==pending.previous_generated[note]&&current!==sha256(content))throw new Error(`Manual edits in ${note} prevent automatic recovery.`);
      }
    }
    for(const [note,content] of Object.entries(pending.outputs))writeAtomic(vault(),note,content);
    for(const [note,hash] of Object.entries(pending.previous_generated)) {
      if(Object.hasOwn(pending.state.generated,note))continue;
      relativePath(note);
      if(!note.endsWith('.md')||note.startsWith('.system/')||note.startsWith('annotations/'))throw new Error('Invalid retired journal path.');
      if(fs.existsSync(vaultFile(note,true))) {
        if(sha256(readBytes(vault(),note,4*1024*1024))!==hash)throw new Error(`Manual edits in ${note} prevent retirement.`);
        removeOwnedFile(vault(),note);
      }
    }
    writeState(pending.state);
    removeOwnedFile(vault(),'.system/pending.json');
  }

  // Standards output is derived from validated records, never supplied as prose
  // by the assessor. A rule or result edit also invalidates exact-note reviews.
  function standardsUpdates(state,{policyChanged=false,sourcePaths}={}) {
    const outputs=renderStandards(state);
    for(const record of state.records.filter(r=>r.status==='included'&&(!sourcePaths||sourcePaths.includes(r.path)))) {
      const note=notePath(record.path);
      outputs[note]=withStandards(readBytes(vault(),note,4*1024*1024).toString('utf8'),state,record);
    }
    if(policyChanged)for(const [note,entry] of Object.entries(state.enrichments||{})) {
      const content=outputs[note]??readBytes(vault(),note,4*1024*1024).toString('utf8');
      outputs[note]=content.replace(/^freshness: current$/m,'freshness: stale');
      state.needs_analysis[note]={kind:entry.kind,source_paths:entry.source_paths,invalidated_at:new Date().toISOString(),reason:'The standards catalog or its policy evidence changed. Recheck relevant claims and standards assessments.'};
      delete state.reviews[note];
    }
    for(const [note,content] of Object.entries(outputs)) {
      if(sha256(content)===state.generated[note])delete outputs[note];
      else delete state.reviews[note];
    }
    const projected={...state,generated:{...state.generated,...Object.fromEntries(Object.entries(outputs).map(([p,c])=>[p,sha256(c)]))}};
    outputs['analysis-index.md']=renderAnalysisIndex(projected);
    return outputs;
  }

  const engine={
    root,vaultName,version:VERSION,
    async scan() {return locked(async()=>{
      recoverPublication();
      const previous=readState();
      const {records,changes}=currentRecords(previous);
      const digest=inventoryDigest(records);
      const git=gitState(root);
      const pending=fs.existsSync(vaultFile('.system/pending.json',true));
      const standards=reconcileStandards(previous?.standards,records,catalog(),new Date().toISOString());
      if(previous&&previous.version===VERSION&&previous.snapshot.source_digest===digest&&previous.snapshot.head===git.head&&!pending&&standardsFingerprint(standards)===standardsFingerprint(previous.standards)) return {snapshot:previous.snapshot,changes,coverage:summary(records),profile:previous.analysis.profile,vault:vaultName,root,unchanged:true,invalidated_note_paths:Object.keys(previous.needs_analysis||{}),standards:standardsCoverage(previous),ignore:ignoreDiagnostics(root,vaultName)};
      const created_at=new Date().toISOString();
      const snapshot={id:`s_${sha256(`${digest}|${git.head}|${created_at}`).slice(0,20)}`,created_at,head:git.head,branch:git.branch,source_digest:digest};
      for(const record of records) {
        const before=previous?.records.find(r=>r.path===record.path);
        record.analyzed_at=before?.sha256===record.sha256&&before?.status===record.status&&previous.version===VERSION?before.analyzed_at||created_at:created_at;
      }
      const analysis=analyzeRepository(records);
      const state={schema_version:SCHEMA_VERSION,version:VERSION,snapshot,records:stripContent(records),analysis,standards,generated:{},enrichments:{},reviews:{},needs_analysis:{...previous?.needs_analysis},coverage:summary(records)};
      const outputs=renderVault({records,analysis,snapshot,previous,version:VERSION,vaultName});
      Object.assign(outputs,renderStandards(state));
      const baseline={...outputs};
      let invalidated=0;
      const retire=(note)=>{
        invalidated++;
        const entry=previous.enrichments[note];
        if(entry.source_paths.some(p=>records.some(r=>r.path===p&&STATES.includes(r.status))))state.needs_analysis[note]={kind:entry.kind,source_paths:entry.source_paths,invalidated_at:created_at,reason:'Source evidence, relationships, navigation, or analysis version changed. Inspect current sources before republishing.'};
        if(fs.existsSync(vaultFile(note,true))) writeAtomic(vault(),`.system/archive/${previous.snapshot.id}/${note}`,readBytes(vault(),note,4*1024*1024));
        outputs[note]=baseline[note]||`---\ntype: retired-analysis\nfreshness: stale\nanalyzed_at: ${yaml(created_at)}\n---\n\n# Analysis needs refresh\n\nIts source evidence or relationships changed or disappeared. Previous generated prose was archived. Re-analyze before using its claims.\n\n[[index|Vault index]]\n`;
        delete state.enrichments[note];delete state.reviews[note];
      };
      for(const [note,entry] of Object.entries(previous?.enrichments||{})) {
        const same=previous.version===VERSION&&entry.standards_hash===standardsFingerprint(standards)&&entry.dependencies.every(dep=>records.some(r=>r.path===dep.path&&r.sha256===dep.sha256&&r.status===dep.status));
        const alive=entry.source_paths.every(p=>records.some(r=>r.path===p&&STATES.includes(r.status)));
        const contextSame=entry.kind==='file'?entry.neighborhood===neighborhood(entry.dependencies.map(d=>d.path),state):previous.snapshot.source_digest===digest;
        if(same&&alive&&contextSame&&fs.existsSync(vaultFile(note,true))) {
          const content=readBytes(vault(),note,4*1024*1024).toString('utf8');
          if(sha256(content)!==previous.generated[note]) throw new Error(`Managed note ${note} has manual edits; move them to annotations/.`);
          outputs[note]=content;state.enrichments[note]=entry;
          const review=previous.reviews?.[note];
          if(review&&review.note_sha256===sha256(content)&&review.evidence.every(e=>records.some(r=>r.path===e.path&&r.sha256===e.sha256&&STATES.includes(r.status)))) state.reviews[note]=review;
        } else {
          retire(note);
        }
      }
      // A removed linked note must invalidate prose, never deadlock a refresh.
      const known=new Set(Object.keys(outputs));
      for(const note of Object.keys(state.enrichments)) if(checkLinks(outputs[note],known,note).length)retire(note);
      for(const [note,item] of Object.entries(state.needs_analysis)) {
        if(!item.source_paths.some(p=>records.some(r=>r.path===p&&STATES.includes(r.status)))){delete state.needs_analysis[note];continue;}
        if(!outputs[note])outputs[note]=`---\ntype: retired-analysis\nfreshness: stale\n---\n\n# Analysis needs refresh\n\n${item.reason}\n\n[[index|Vault index]]\n`;
      }
      for(const record of records.filter(r=>r.status==='included')) {
        const note=notePath(record.path);
        outputs[note]=withStandards(outputs[note],state,record);
        if(state.reviews[note]?.note_sha256!==sha256(outputs[note]))delete state.reviews[note];
      }
      outputs['analysis-index.md']=renderAnalysisIndex({...state,generated:Object.fromEntries(Object.entries(outputs).map(([note,content])=>[note,sha256(content)]))});
      // Persist normalized source fingerprints only; timestamps are not inventory inputs.
      state.snapshot.source_digest=inventoryDigest(records.map(({analyzed_at,...r})=>r));
      assertCurrent(state);
      publishBatch(outputs,state,previous);
      return {snapshot,changes,coverage:state.coverage,profile:analysis.profile,vault:vaultName,root,invalidated_notes:invalidated,invalidated_note_paths:Object.keys(state.needs_analysis),standards:standardsCoverage(state),ignore:ignoreDiagnostics(root,vaultName)};
    },{init:true});},
    async refresh(){return engine.scan();},
    async status(){
      const state=readState();
      if(!state)return {initialized:false,fresh:false,version:VERSION,vault:vaultName,root,ignore:ignoreDiagnostics(root,vaultName)};
      const {records,changes}=currentRecords(state);
      const git=gitState(root);
      const pending=fs.existsSync(vaultFile('.system/pending.json',true));
      const currentStandards=reconcileStandards(state.standards,records,catalog(),state.snapshot.created_at);
      const standardsFresh=standardsFingerprint(currentStandards)===standardsFingerprint(state.standards);
      const liveState={...state,records,standards:currentStandards,analysis:noChanges(changes)?state.analysis:analyzeRepository(records)};
      return {initialized:true,fresh:noChanges(changes)&&state.version===VERSION&&state.snapshot.head===git.head&&!pending&&standardsFresh,changes,version:VERSION,generated_version:state.version,snapshot:state.snapshot,coverage:summary(records),pending_update:pending,pending_analysis:Object.keys(state.needs_analysis||{}).length,vault:vaultName,root,standards:standardsCoverage(liveState),ignore:ignoreDiagnostics(root,vaultName)};
    },
    async list({kind,offset=0,limit=100}={}){
      const state=requireState();
      if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>500)throw new Error('Invalid pagination.');
      const items=kind==='notes'?Object.keys(state.generated).sort().map(note=>({path:note,sha256:state.generated[note],analysis_level:state.enrichments[note]?'agent':'static',review:state.reviews[note]||null,needs_analysis:state.needs_analysis?.[note]||null})):state.records.filter(r=>!kind||r.kind===kind||r.status===kind).map(r=>({...r,...(r.status==='included'?{note_path:notePath(r.path)}:{})}));
      return {items:items.slice(offset,offset+limit),total:items.length,offset,limit,snapshot:state.snapshot.id};
    },
    async read({path:sourcePath,start_line=1,end_line}={}){
      const state=requireState(),source=currentSource(sourcePath,state);
      if(source.language==='xlsx')return {path:source.path,sha256:source.sha256,format:'xlsx',workbook:inspectWorkbook(source.bytes),limitations:['Workbook inspection exposes structure and bounded cell addresses, not interpreted control definitions.']};
      const lines=source.bytes.toString('utf8').split(/\r?\n/);
      const end=end_line??Math.min(lines.length,start_line+199);
      if(!Number.isInteger(start_line)||!Number.isInteger(end)||start_line<1||end<start_line||end>lines.length||end-start_line>500)throw new Error('Read range must be within the file and at most 501 lines.');
      const selected=lines.slice(start_line-1,end).join('\n');
      if(selected.length>64000)throw new Error('Read range exceeds the character limit; request fewer lines.');
      return {path:source.path,sha256:source.sha256,start_line,end_line:end,total_lines:lines.length,text:selected};
    },
    async search({query,limit=30}={}){
      textValue(query,200);
      if(!query||!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Search requires a query and limit 1–100.');
      const state=requireState(),matches=[];
      for(const record of state.records.filter(r=>STATES.includes(r.status)&&r.language!=='xlsx')) {
        const source=currentSource(record.path,state);
        const lines=source.bytes.toString('utf8').split(/\r?\n/);
        for(let i=0;i<lines.length;i++)if(lines[i].toLowerCase().includes(query.toLowerCase())) {
          matches.push({path:record.path,line:i+1,text:lines[i].slice(0,500),sha256:source.sha256});
          if(matches.length>=limit)return {matches,truncated:true};
        }
      }
      return {matches,truncated:false};
    },
    async packet({path:sourcePath}={}){
      const state=requireState();assertCurrent(state);
      const source=currentSource(sourcePath,state);
      const {bytes,...clean}=source;
      return {source:clean,facts:state.analysis.files.find(f=>f.path===sourcePath)||null,relationships:state.analysis.relations.filter(r=>[sourcePath,source.id].includes(r.from)||[sourcePath,source.id].includes(r.to)),standards:source.status==='included'?fileStandards(state,source):[],profile:state.analysis.profile,snapshot:state.snapshot,source_preview:await engine.read({path:sourcePath})};
    },
    async standards({path:sourcePath,offset=0,limit=100}={}) {
      const state=requireState();assertCurrent(state);
      if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Invalid standards pagination.');
      let rules;
      if(sourcePath!==undefined) {
        const record=currentSource(sourcePath,state);
        if(record.status!=='included')throw new Error('Standards assessment is for included source files.');
        rules=fileStandards(state,record).map(({rule,assessment})=>({...rule,assessment}));
      } else rules=Object.values(state.standards.rules).sort((a,b)=>a.id.localeCompare(b.id));
      return {rules:rules.slice(offset,offset+limit),total:rules.length,offset,limit,coverage:standardsCoverage(state),snapshot:state.snapshot.id};
    },
    async rule(input={}) {return locked(async()=>{
      const state=requireState();assertCurrent(state);
      if(!['declared','convention'].includes(input.authority))throw new Error('Custom rules must be declared project requirements or observed conventions; bundled advisory rules are immutable.');
      const before=state.standards.rules[input.id];
      if(before?.authority==='advisory')throw new Error('Bundled advisory rules cannot be overridden. Register a separately evidenced project rule.');
      if(before&&before.category!==input.category)throw new Error('A rule category is stable. Use a distinct id for a different rule.');
      if(!before&&Object.keys(state.standards.rules).length>=200)throw new Error('The bounded catalog supports at most 200 rules.');
      const values={};
      for(const [key,max] of Object.entries({title:240,requirement:4000,rationale:4000,verification:4000})) {
        values[key]=textValue(input[key],max);
        if(!values[key].trim())throw new Error(`Rule ${key} cannot be empty.`);
        if(noteLinks(values[key]).length)throw new Error('Rule text uses plain descriptions and evidence; wiki navigation is generated by the broker.');
      }
      const evidence=evidenceCheck(input.evidence,state);
      const rule=makeRule({...values,id:input.id,category:input.category,scope:input.scope,authority:input.authority,evidence,registered_at:new Date().toISOString()});
      if(!before&&state.generated[rule.note_path])throw new Error('The rule destination is already occupied by a different managed note. Choose a distinct rule id.');
      if(before?.hash===rule.hash&&before.freshness==='current')return {rule:before,unchanged:true};
      const previousGenerated={...state.generated};
      state.standards.rules[rule.id]=rule;
      const outputs=standardsUpdates(state,{policyChanged:true});
      evidenceCheck(evidence,state);assertCurrent(state);
      publishUpdates(outputs,state,previousGenerated);
      return {rule,coverage:standardsCoverage(state),invalidated_note_paths:Object.keys(state.needs_analysis)};
    });},
    async assess({path:sourcePath,expected_source_sha256,assessments}={}) {return locked(async()=>{
      const state=requireState();assertCurrent(state);
      const source=currentSource(sourcePath,state);
      if(source.status!=='included'||source.sha256!==expected_source_sha256)throw new Error('Assessment requires an included source and its current source hash.');
      if(!Array.isArray(assessments)||!assessments.length||assessments.length>100)throw new Error('Supply 1–100 rule assessments.');
      const entries={},now=new Date().toISOString();
      for(const input of assessments) {
        const rule=state.standards.rules[input.rule_id];
        if(!rule||rule.hash!==input.rule_hash||rule.freshness!=='current')throw new Error('Assessment rule hash is missing, stale, or its policy evidence needs refresh.');
        if(!applies(rule,source))throw new Error('The rule scope does not include this source.');
        if(!RESULTS.includes(input.result))throw new Error('Invalid assessment result.');
        if(input.result==='noncompliant'&&rule.authority!=='declared')throw new Error('Noncompliant requires an explicit declared project requirement; advisory guidance or conventions may diverge.');
        if(entries[rule.id])throw new Error('Assess each rule once per call.');
        const rationale=textValue(input.rationale,4000);
        if(!rationale.trim()||noteLinks(rationale).length)throw new Error('Supply a plain-language rationale; navigation is derived.');
        const evidence=evidenceCheck(input.evidence,state);
        if(!evidence.some(e=>e.path===sourcePath))throw new Error('Assessment evidence must include the assessed source itself.');
        const dependencies=dependenciesFor([...new Set([sourcePath,...evidence.map(e=>e.path)])],state);
        entries[rule.id]={rule_id:rule.id,rule_hash:rule.hash,source_hash:source.sha256,result:input.result,rationale,evidence,dependencies,neighborhood:neighborhood(dependencies.map(d=>d.path),state),assessed_at:now,method:'source-inspection'};
      }
      const previousGenerated={...state.generated};
      state.standards.assessments[sourcePath]={...state.standards.assessments[sourcePath],...entries};
      const outputs=standardsUpdates(state,{sourcePaths:[sourcePath]});
      for(const item of Object.values(entries))evidenceCheck(item.evidence,state);
      assertCurrent(state);publishUpdates(outputs,state,previousGenerated);
      return {path:sourcePath,assessments:fileStandards(state,source),coverage:standardsCoverage(state)};
    });},
    async publish(input={}) {return locked(async()=>{
      const state=requireState();
      assertCurrent(state);
      const prefixes={file:'files',component:'components',flow:'flows',standard:'standards',finding:'improvements',onboarding:'onboarding',profile:'profiles'};
      if(!Object.hasOwn(prefixes,input.kind))throw new Error('Unknown note kind.');
      const title=textValue(input.title,240),summaryText=textValue(input.summary,4000);
      if(!title.trim()||!summaryText.trim())throw new Error('A title and summary are required.');
      if(!Array.isArray(input.source_paths)||!input.source_paths.length||input.source_paths.length>100)throw new Error('Published notes need 1–100 source paths.');
      const sourcePaths=[...new Set(input.source_paths)];
      for(const p of sourcePaths)currentSource(p,state);
      let destination;
      if(input.kind==='file') {
        const source=state.records.find(r=>r.path===sourcePaths[0]);
        if(source.status!=='included')throw new Error('Reference-only documents do not receive duplicate file notes.');
        destination=notePath(sourcePaths[0]);
      } else {
        if(typeof input.slug!=='string'||!/^[a-z0-9][a-z0-9/-]{0,160}$/.test(input.slug))throw new Error('Use a lowercase, path-safe note slug.');
        relativePath(input.slug);destination=`${prefixes[input.kind]}/${input.slug}.md`;
      }
      if(Object.hasOwn(renderStandards(state),destination)||/^standards\/(?:general|languages|testing|cicd|databases|transformations)\//.test(destination))throw new Error('Standards catalog pages are broker-owned. Use vault_rule and vault_assess.');
      if(!Array.isArray(input.sections)||!input.sections.length||input.sections.length>20)throw new Error('Provide 1–20 evidenced sections.');
      const sections=input.sections.map(section=>({heading:textValue(section.heading,160),text:textValue(section.text,16000),evidence:evidenceCheck(section.evidence,state)}));
      const evidence=sections.flatMap(s=>s.evidence);
      const covered=new Set(evidence.map(e=>e.path));
      if(sourcePaths.some(p=>!covered.has(p)))throw new Error('Every declared source needs evidence in a section.');
      const related=[...new Set(noteLinks([summaryText,...sections.map(s=>s.text)].join('\n')))];
      const linkedSources=state.records.filter(r=>related.some(link=>`${link.replace(/\.md$/,'')}.md`===notePath(r.path))).map(r=>r.path);
      const dependencies=dependenciesFor([...new Set([...sourcePaths,...covered,...linkedSources])],state);
      const now=new Date().toISOString();
      const id=input.kind==='file'?state.records.find(r=>r.path===sourcePaths[0]).id:`n_${sha256(destination).slice(0,16)}`;
      const lines=['---',`id: ${yaml(id)}`,`type: ${yaml(input.kind)}`,`title: ${yaml(title)}`,`analyzed_at: ${yaml(now)}`,`verified_at: ${yaml(now)}`,`source_snapshot: ${yaml(state.snapshot.id)}`,`source_revision: ${yaml(state.snapshot.head)}`,`generator_version: ${yaml(VERSION)}`,'analysis_level: agent','review_status: draft','freshness: current',`source_path: ${yaml(sourcePaths[0])}`,`source_hash: ${yaml(state.records.find(r=>r.path===sourcePaths[0]).sha256)}`,`related: ${yaml(related.map(link=>`[[${link}]]`))}`,'sources:',...sourcePaths.map(p=>`  - ${yaml(p)}`),'---','',`# ${title.replace(/[\r\n]/g,' ')}`,'',summaryText,'','[[index|Vault index]]',''];
      for(const section of sections) {
        lines.push(`## ${section.heading.replace(/[\r\n]/g,' ')}`,'',section.text,'','Evidence:',...section.evidence.map(e=>`- \`${e.path}${e.selector?(e.selector.kind==='workbook'?' [workbook]':` [${e.selector.sheet}${e.selector.cell?`!${e.selector.cell}`:''}]`):`:${e.start_line}-${e.end_line}`}\` · SHA-256 \`${e.sha256}\``),'');
      }
      const content=input.kind==='file'?withStandards(lines.join('\n'),state,state.records.find(r=>r.path===sourcePaths[0])):lines.join('\n');
      const linkErrors=checkLinks(content,new Set(Object.keys(state.generated)),destination);
      if(linkErrors.length)throw new Error(linkErrors.join('; '));
      const absolute=vaultFile(destination,true);
      if(fs.existsSync(absolute)&&!state.generated[destination])throw new Error('Refusing to overwrite an unmanaged note.');
      if(fs.existsSync(absolute)&&sha256(readBytes(vault(),destination,4*1024*1024))!==state.generated[destination])throw new Error('This note has manual edits. Preserve them in annotations/ first.');
      // Recheck evidence immediately before publication. A changed snapshot fails closed.
      evidenceCheck(evidence,state);
      assertCurrent(state);
      const previousGenerated={...state.generated};
      state.generated[destination]=sha256(content);
      state.enrichments[destination]={kind:input.kind,source_paths:sourcePaths,dependencies,neighborhood:neighborhood(dependencies.map(d=>d.path),state),standards_hash:standardsFingerprint(state.standards),evidence,analyzed_at:now,producer_version:VERSION};
      delete state.reviews[destination];
      if(state.needs_analysis)delete state.needs_analysis[destination];
      publishUpdates({[destination]:content,'analysis-index.md':renderAnalysisIndex(state)},state,previousGenerated);
      return {path:destination,sha256:sha256(content),review_status:'draft',snapshot:state.snapshot.id};
    });},
    async note({path:note}={}){
      const state=requireState();relativePath(note);
      if(!state.generated[note]&&!note.startsWith('annotations/'))throw new Error('Only managed notes and annotations can be read through this tool.');
      const content=readBytes(vault(),note,1024*1024).toString('utf8');
      return {path:note,text:content,sha256:sha256(content),review:state.reviews?.[note]||null,needs_analysis:state.needs_analysis?.[note]||null};
    },
    async review({note_path,expected_note_sha256,verdict,reason,evidence}={}) {return locked(async()=>{
      const state=requireState();
      assertCurrent(state);
      if(!['supported','needs-revision','unresolved'].includes(verdict))throw new Error('Invalid review verdict.');
      const current=await engine.note({path:note_path});
      if(!state.generated[note_path]||current.sha256!==expected_note_sha256||current.sha256!==state.generated[note_path])throw new Error('Review note hash is missing or changed. Read the current note again.');
      const validated=evidenceCheck(evidence,state);
      assertCurrent(state);
      state.reviews[note_path]={verdict,reason:textValue(reason,4000),evidence:validated,note_sha256:current.sha256,reviewed_at:new Date().toISOString(),reviewer_type:'agent'};
      publishUpdates({'analysis-index.md':renderAnalysisIndex(state)},state,{...state.generated});
      return {path:note_path,...state.reviews[note_path]};
    });},
    async lint(){
      const state=requireState(),errors=[],warnings=[];
      const known=new Set(Object.keys(state.generated));
      for(const [note,hash] of Object.entries(state.generated)) {
        try {
          const content=readBytes(vault(),note,4*1024*1024).toString('utf8');
          if(sha256(content)!==hash)errors.push(`${note}: changed outside the managed publisher.`);
          if(!content.startsWith('---\n')&&!content.startsWith('---\r\n'))errors.push(`${note}: missing metadata header.`);
          errors.push(...checkLinks(content,known,note).map(e=>`${note}: ${e}`));
        } catch(error) {errors.push(`${note}: ${error.message}`);}
      }
      for(const record of state.records.filter(r=>r.status==='included'))if(!known.has(notePath(record.path)))errors.push(`Missing note for ${record.path}.`);
      for(const [note,entry] of Object.entries(state.enrichments)) {
        try {evidenceCheck(entry.evidence,state);}catch(error){errors.push(`${note}: ${error.message}`);}
        if(!state.reviews[note]||state.reviews[note].verdict!=='supported')warnings.push(`${note}: no current supporting agent review.`);
      }
      for(const [note,review] of Object.entries(state.reviews||{})) {
        if(review.note_sha256!==state.generated[note])errors.push(`${note}: review refers to an older note.`);
        try {evidenceCheck(review.evidence,state);}catch(error){errors.push(`${note}: review evidence is stale: ${error.message}`);}
      }
      const freshness=await engine.status();
      warnings.push(...freshness.ignore.warnings);
      const standards=freshness.standards;
      if(standards['not-assessed'])warnings.push(`${standards['not-assessed']} candidate standards assessments are missing or stale; this does not imply a violation.`);
      for(const [sourcePath,items] of Object.entries(state.standards?.assessments||{}))for(const item of Object.values(items)) {
        const rule=state.standards.rules[item.rule_id];
        if(item.result==='noncompliant'&&rule?.authority!=='declared')errors.push(`${sourcePath}: noncompliant assessment lacks a declared requirement.`);
      }
      if(freshness.pending_analysis)warnings.push(`${freshness.pending_analysis} previously enriched notes need fresh analysis; inspect the needs_analysis fields in the note inventory.`);
      if(!freshness.fresh)warnings.push('Sources, plugin version, or publication state changed; run sync.');
      if(state.records.some(r=>r.status==='unsupported'||r.status==='error'))warnings.push('Some sources are unsupported or unreadable; see coverage.');
      return {ok:errors.length===0,errors,warnings,snapshot:state.snapshot.id,standards,checks:['managed-file integrity','wiki targets','source coverage','evidence locators','freshness','standards authority and coverage'],limitations:['Mechanical validation does not establish semantic truth or runtime behavior.']};
    },
    async context({topic}={}){
      if(topic==='index') {
        const assets=[];
        const walk=relative=>{
          for(const entry of fs.readdirSync(checkedPath(PACKAGE_ROOT,relative),{withFileTypes:true})) {
            const next=`${relative}/${entry.name}`;
            if(entry.isDirectory())walk(next);
            else if(entry.isFile()&&/\.(?:md|json)$/.test(entry.name))assets.push(next);
          }
        };
        for(const folder of ['policies','workflows','packs','templates','docs','schemas'])if(fs.existsSync(path.join(PACKAGE_ROOT,folder)))walk(folder);
        return {topics:assets.sort(),version:VERSION};
      }
      const aliases={policy:'policies/core.md',build:'workflows/build.md',sync:'workflows/sync.md'};
      const relative=aliases[topic]||relativePath(topic);
      if(!/^(?:policies|workflows|packs|templates|docs|schemas)\/.+\.(?:md|json)$/.test(relative))throw new Error('Context is limited to bundled documentation and schemas.');
      return {topic:relative,text:readBytes(PACKAGE_ROOT,relative,128*1024).toString('utf8'),version:VERSION};
    }
  };
  return engine;
}
