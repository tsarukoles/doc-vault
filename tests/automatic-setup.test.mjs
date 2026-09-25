import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { temporaryDirectory, hashes } from './helpers.mjs';
import { mcpClient } from './mcp-client.mjs';
import { invalidateRuns } from '../src/run-authorization.mjs';
import { createEngine } from '../src/engine.mjs';

const write=(root,file,text)=>{fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),text);};
const read=(root,file)=>fs.readFileSync(path.join(root,file),'utf8');
const has=(root,file)=>fs.existsSync(path.join(root,file));
const git=(root,...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']});
async function repo(t) {
  const root=await temporaryDirectory(t,'edw-doc-auto-setup-');
  git(root,'init','--quiet');
  write(root,'src/main.js','export const value = 42;\n');
  return root;
}
async function approve(client,root,command) {
  const session_id=crypto.randomUUID();
  invalidateRuns(root,{hook_event_name:'UserPromptSubmit',session_id});
  const begin=await client.call('vault_begin',{command,session_id});
  assert.equal(begin.isError,false,begin.content[0].text);
  return begin.structuredContent.run_id;
}

test('approved build installs missing project integration and repairs it within the same run',async t=>{
  const root=await repo(t), before=await hashes(root), client=await mcpClient(t,root);
  assert.deepEqual(await hashes(root),before,'Loading the broker must not install project files');
  const run_id=await approve(client,root,'build');
  assert.deepEqual(await hashes(root),before,'Approval alone must not perform setup');
  const scan=await client.call('vault_scan',{run_id});
  assert.equal(scan.isError,false,scan.content[0].text);
  assert.equal(scan.structuredContent.integration.installed,true);
  assert.equal(scan.structuredContent.integration.entrypoint,'CLAUDE.md');
  assert.equal(scan.structuredContent.ignore.git_verified,true);
  assert.match(read(root,'CLAUDE.md'),/@\.claude\/edw-doc\/instructions\.md/);
  for(const file of ['instructions.md','config.json','manifest.json'])assert.ok(has(root,`.claude/edw-doc/${file}`));
  assert.equal(git(root,'status','--porcelain','--','edw-doc','.claude','CLAUDE.md').trim(),'');
  const installed=await hashes(root,{exclude:['.git']});
  const repeated=await client.call('vault_scan',{run_id});
  assert.equal(repeated.isError,false,repeated.content[0].text);
  assert.deepEqual(repeated.structuredContent.integration.changes,[]);
  assert.deepEqual(await hashes(root,{exclude:['.git']}),installed);
  fs.unlinkSync(path.join(root,'.claude/edw-doc/instructions.md'));
  fs.unlinkSync(path.join(root,'CLAUDE.md'));
  const repaired=await client.call('vault_refresh',{run_id});
  assert.equal(repaired.isError,false,repaired.content[0].text);
  assert.ok(repaired.structuredContent.integration.repairs.includes('CLAUDE.md'));
  assert.ok(repaired.structuredContent.integration.repairs.includes('.claude/edw-doc/instructions.md'));
  assert.equal(read(root,'src/main.js'),'export const value = 42;\n');
  assert.equal((await client.call('vault_end',{run_id})).isError,false);
});

test('sync upgrades an existing vault and preserves tracked instructions and unrelated Claude files',async t=>{
  const root=await repo(t);
  const preserved={
    'CLAUDE.md':'# Shared project instructions\nKeep this unchanged.\n',
    '.claude/settings.json':'{"hooks":{"Stop":[]}}\n',
    '.claude/scripts/custom.js':'console.log("user script");\n',
    '.claude/agents/custom.md':'# Existing custom agent\n',
  };
  for(const [file,text]of Object.entries(preserved))write(root,file,text);
  git(root,'add','--','CLAUDE.md','.claude/settings.json');
  await (await createEngine(root)).scan();
  assert.equal(has(root,'.claude/edw-doc'),false,'Static scans do not implicitly install integration');
  const client=await mcpClient(t,root),run_id=await approve(client,root,'sync');
  const result=await client.call('vault_refresh',{run_id});
  assert.equal(result.isError,false,result.content[0].text);
  assert.equal(result.structuredContent.integration.entrypoint,'.claude/rules/edw-doc.md');
  assert.match(read(root,'.claude/rules/edw-doc.md'),/\.claude\/edw-doc\/instructions.md/);
  for(const [file,text]of Object.entries(preserved))assert.equal(read(root,file),text);
  assert.deepEqual(git(root,'ls-files','--','.claude').trim().split('\n'),['.claude/settings.json']);
  const config={version:1,vaultName:'edw-doc',maintenance:{enabled:false}};
  write(root,'.claude/edw-doc/config.json',JSON.stringify(config));
  write(root,'.claude/edw-doc/instructions.md','# User-edited plugin instructions\n');
  const repeated=await client.call('vault_refresh',{run_id});
  assert.equal(repeated.isError,false,repeated.content[0].text);
  assert.equal(repeated.structuredContent.integration.maintenanceEnabled,false);
  assert.equal(read(root,'.claude/edw-doc/config.json'),JSON.stringify(config));
  assert.equal(read(root,'.claude/edw-doc/instructions.md'),'# User-edited plugin instructions\n');
});

test('build adds a Claude entry point alongside existing AGENTS guidance',async t=>{
  const root=await repo(t);
  write(root,'AGENTS.md','# Existing agent policy\n');
  const client=await mcpClient(t,root),run_id=await approve(client,root,'build');
  const result=await client.call('vault_scan',{run_id});
  assert.equal(result.isError,false,result.content[0].text);
  assert.ok(has(root,'CLAUDE.md'));
  assert.equal(read(root,'AGENTS.md'),'# Existing agent policy\n');
});

test('setup cannot be requested by model input or a read-only or audit grant',async t=>{
  const root=await repo(t),client=await mcpClient(t,root);
  const before=await hashes(root);
  for(const command of ['status','ask']) {
    const run_id=await approve(client,root,command);
    const status=await client.call('vault_status',{run_id});
    assert.equal(status.structuredContent.integration.installed,false);
    assert.equal((await client.call('vault_scan',{run_id})).isError,true);
  }
  assert.deepEqual(await hashes(root),before);
  const run_id=await approve(client,root,'audit');
  assert.equal((await client.call('vault_scan',{run_id,integrate:true})).isError,true);
  assert.equal((await client.call('vault_scan',{run_id})).isError,false);
  assert.equal(has(root,'.claude'),false);
  assert.equal(has(root,'CLAUDE.md'),false);
});

test('automatic setup reports a namespace collision without overwriting existing integration files',async t=>{
  const root=await repo(t);
  write(root,'.claude/edw-doc/instructions.md','# Unowned local content\n');
  const before=await hashes(root),client=await mcpClient(t,root),run_id=await approve(client,root,'build');
  const result=await client.call('vault_scan',{run_id});
  assert.equal(result.isError,true);
  assert.match(result.content[0].text,/collision|ownership/i);
  assert.deepEqual(await hashes(root,{exclude:['edw-doc','.gitignore']}),before);
  assert.equal(has(root,'CLAUDE.md'),false);
});

test('a non-Git folder reports automatic integration skipped without losing documentation support',async t=>{
  const root=await temporaryDirectory(t,'edw-doc-auto-nongit-');
  write(root,'src/main.js','export const value = 42;\n');
  const client=await mcpClient(t,root),run_id=await approve(client,root,'build');
  const result=await client.call('vault_scan',{run_id});
  assert.equal(result.isError,false,result.content[0].text);
  assert.equal(result.structuredContent.integration.installed,false);
  assert.equal(result.structuredContent.integration.skipped,true);
  assert.equal(result.structuredContent.ignore.git_verified,false);
  assert.equal(has(root,'CLAUDE.md'),false);
  assert.ok(has(root,'edw-doc/index.md'));
});

test('an active writer prevents integration and ignore changes before scan starts',async t=>{
  const root=await repo(t),engine=await createEngine(root);
  await engine.scan();
  write(root,'edw-doc/.system/write-lock.json',JSON.stringify({host:os.hostname(),pid:process.pid,token:'another-writer'}));
  write(root,'.gitignore','# Existing writer owns the snapshot\n');
  const before=await hashes(root);
  await assert.rejects(engine.scan({integrate:true}),/writer is active/);
  assert.deepEqual(await hashes(root),before);
  assert.equal(has(root,'.claude'),false);
});

test('a legacy vault migration requirement does not leave incompatible new integration behind',async t=>{
  const root=await repo(t);
  await (await createEngine(root,{vaultName:'doc-vault'})).scan();
  const before=await hashes(root),engine=await createEngine(root);
  await assert.rejects(engine.scan({integrate:true}),/explicit migration/);
  assert.deepEqual(await hashes(root),before);
  assert.equal(has(root,'.claude'),false);
  assert.equal(has(root,'CLAUDE.md'),false);
});

test('an explicitly configured subdirectory is rejected before any first-run mutation',async t=>{
  const root=await repo(t),subdirectory=path.join(root,'src');
  const before=await hashes(root),engine=await createEngine(subdirectory);
  await assert.rejects(engine.scan({integrate:true}),/requires the Git repository root.*No project files were changed/);
  assert.deepEqual(await hashes(root),before);
});
