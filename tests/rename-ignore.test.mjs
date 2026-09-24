import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { createEngine } from '../src/engine.mjs';
import { ensureIgnore } from '../src/security.mjs';
import { ignoreDiagnostics, inventory } from '../src/inventory.mjs';
import { fixture, hashes, temporaryDirectory } from './helpers.mjs';

const cli=fileURLToPath(new URL('../scripts/cli.mjs',import.meta.url));
const migrate=(root,from='doc-vault',to='edw-doc')=>spawnSync(process.execPath,[cli,'migrate','--root',root,'--from',from,'--to',to],{encoding:'utf8',windowsHide:true});
async function oldVault(t) {
  const root=await fixture(t,'security');
  const engine=await createEngine(root,{vaultName:'doc-vault'});
  await engine.scan();
  return {root,engine};
}

test('missing gitignore is created with both protected roots and remains idempotent',async t=>{
  const root=await fixture(t,'security');
  assert.equal(fs.existsSync(path.join(root,'.gitignore')),false);
  const before=await hashes(root);
  const diagnostic=ignoreDiagnostics(root,'edw-doc');
  assert.equal(diagnostic.gitignore_exists,false);
  assert.deepEqual(diagnostic.missing_rules,['/edw-doc/','/.claude/']);
  assert.deepEqual(await hashes(root),before,'Diagnostics are read-only');
  assert.equal(ensureIgnore(root,'edw-doc'),true);
  assert.equal(fs.readFileSync(path.join(root,'.gitignore'),'utf8'),'/edw-doc/\n/.claude/\n');
  assert.equal(ensureIgnore(root,'edw-doc'),false);
  assert.deepEqual(ignoreDiagnostics(root,'edw-doc').missing_rules,[]);
});

test('ignore repair preserves exact existing bytes and CRLF while overriding later negation',async t=>{
  const root=await fixture(t,'security');
  const original=Buffer.from('\ufeff# Local choices\r\n/edw-doc/\r\n/.claude/\r\n!/.claude/\r\n!/edw-doc/\r\n*.log');
  fs.writeFileSync(path.join(root,'.gitignore'),original);
  ensureIgnore(root,'edw-doc');
  const current=fs.readFileSync(path.join(root,'.gitignore'));
  assert.deepEqual(current.subarray(0,original.length),original);
  assert.equal(current.subarray(original.length).toString(),'\r\n/edw-doc/\r\n/.claude/\r\n');
  assert.equal(ensureIgnore(root,'edw-doc'),false);
});

test('equivalent existing directory rules do not receive duplicates',async t=>{
  const root=await fixture(t,'security');
  const original='edw-doc/\n.claude/\n*.log\n';
  fs.writeFileSync(path.join(root,'.gitignore'),original);
  assert.equal(ensureIgnore(root,'edw-doc'),false);
  assert.equal(fs.readFileSync(path.join(root,'.gitignore'),'utf8'),original);
});

test('tracked Claude settings are reported but excluded from source inventory',async t=>{
  if(spawnSync('git',['--version'],{stdio:'ignore'}).status!==0)return t.skip('Git unavailable');
  const root=await fixture(t,'security');
  fs.mkdirSync(path.join(root,'.claude'));
  fs.writeFileSync(path.join(root,'.claude','settings.json'),'{"session":"private fixture"}\n');
  execFileSync('git',['init','--quiet','--template=',root],{stdio:'pipe',windowsHide:true});
  execFileSync('git',['-C',root,'add','--','.claude/settings.json'],{stdio:'pipe',windowsHide:true});
  const before=await hashes(root);
  const report=ignoreDiagnostics(root,'edw-doc');
  assert.deepEqual(report.tracked_claude_files,['.claude/settings.json']);
  assert.match(report.warnings.join(' '),/already tracked/);
  const records=inventory(root,'edw-doc');
  assert.equal(records.find(item=>item.path==='.claude')?.status,'excluded');
  assert.ok(!records.some(item=>item.path.startsWith('.claude/')));
  assert.ok(!JSON.stringify(records).includes('private fixture'));
  assert.deepEqual(await hashes(root),before,'Inspection cannot untrack or modify settings');
});

test('explicit vault migration preserves every owned byte and existing links',async t=>{
  const {root}=await oldVault(t);
  const annotation=path.join(root,'doc-vault','annotations','personal.md');
  fs.mkdirSync(path.dirname(annotation),{recursive:true});
  fs.writeFileSync(annotation,'# My note\n[[files/src/safe.js]]\n');
  const original=await hashes(path.join(root,'doc-vault'));
  const source=await hashes(path.join(root,'src'));
  const result=migrate(root);
  assert.equal(result.status,0,result.stderr);
  assert.equal(JSON.parse(result.stdout).migrated,true);
  assert.equal(fs.existsSync(path.join(root,'doc-vault')),false);
  assert.deepEqual(await hashes(path.join(root,'edw-doc')),original);
  assert.deepEqual(await hashes(path.join(root,'src')),source);
  assert.match(fs.readFileSync(path.join(root,'.gitignore'),'utf8'),/^\/edw-doc\/$/m);
  const movedEngine=await createEngine(root,{vaultName:'edw-doc'});
  const lint=await movedEngine.lint();
  assert.equal(lint.ok,true,JSON.stringify(lint));
});

test('migration requires all explicit arguments and accepts a custom destination',async t=>{
  const {root}=await oldVault(t);
  const missing=spawnSync(process.execPath,[cli,'migrate','--root',root],{encoding:'utf8',windowsHide:true});
  assert.equal(missing.status,1);
  assert.match(missing.stderr,/explicit/);
  const result=migrate(root,'doc-vault','my-local-vault');
  assert.equal(result.status,0,result.stderr);
  assert.ok(fs.existsSync(path.join(root,'my-local-vault','.system','owner.json')));
});

for(const condition of ['destination','unowned','lock','journal']) {
  test(`migration refuses ${condition} before changing sources or outputs`,async t=>{
    const {root}=await oldVault(t);
    if(condition==='destination')fs.mkdirSync(path.join(root,'edw-doc'));
    if(condition==='unowned')fs.writeFileSync(path.join(root,'doc-vault','.system','owner.json'),'{"product":"another-tool","schema_version":1}\n');
    if(condition==='lock')fs.writeFileSync(path.join(root,'doc-vault','.system','write-lock.json'),'{"pid":1}\n');
    if(condition==='journal')fs.writeFileSync(path.join(root,'doc-vault','.system','pending.json'),'{}\n');
    const original=await hashes(root);
    const result=migrate(root);
    assert.equal(result.status,1,result.stdout);
    assert.deepEqual(await hashes(root),original);
    assert.ok(fs.existsSync(path.join(root,'doc-vault')));
  });
}

test('migration rejects traversal and a destination symlink or junction',async t=>{
  const {root}=await oldVault(t);
  const outside=await temporaryDirectory(t,'doc-vault-migration-outside-');
  fs.writeFileSync(path.join(outside,'untouched.txt'),'Keep');
  assert.equal(migrate(root,'doc-vault','../outside').status,1);
  try {fs.symlinkSync(outside,path.join(root,'edw-doc'),process.platform==='win32'?'junction':'dir');}
  catch(error){if(['EPERM','EACCES','ENOTSUP'].includes(error.code))return t.skip('Directory links unavailable');throw error;}
  const original=await hashes(root);
  const external=await hashes(outside);
  const result=migrate(root);
  assert.equal(result.status,1);
  assert.deepEqual(await hashes(root),original);
  assert.deepEqual(await hashes(outside),external);
});

test('migration rejects hard-linked content and preserves the external file',async t=>{
  const {root}=await oldVault(t);
  const outside=await temporaryDirectory(t,'doc-vault-migration-hardlink-');
  const external=path.join(outside,'note.md');
  fs.writeFileSync(external,'Keep externally linked file');
  fs.mkdirSync(path.join(root,'doc-vault','annotations'),{recursive:true});
  try {fs.linkSync(external,path.join(root,'doc-vault','annotations','linked.md'));}
  catch(error){if(['EPERM','EACCES','ENOTSUP','EXDEV'].includes(error.code))return t.skip('Hard links unavailable');throw error;}
  const original=await hashes(root);
  const result=migrate(root);
  assert.equal(result.status,1);
  assert.match(result.stderr,/hard.link/i);
  assert.deepEqual(await hashes(root),original);
  assert.equal(fs.readFileSync(external,'utf8'),'Keep externally linked file');
});

test('migration refuses tracked generated files instead of changing Git tracking',async t=>{
  if(spawnSync('git',['--version'],{stdio:'ignore'}).status!==0)return t.skip('Git unavailable');
  const {root}=await oldVault(t);
  execFileSync('git',['init','--quiet','--template=',root],{stdio:'pipe',windowsHide:true});
  execFileSync('git',['-C',root,'add','--force','--','doc-vault/index.md'],{stdio:'pipe',windowsHide:true});
  const original=await hashes(root);
  const result=migrate(root);
  assert.equal(result.status,1);
  assert.match(result.stderr,/tracked/);
  assert.deepEqual(await hashes(root),original);
});
