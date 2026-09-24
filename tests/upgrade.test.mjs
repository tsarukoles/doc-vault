import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createEngine } from '../src/engine.mjs';
import { fixture, hashes, sourceNote } from './helpers.mjs';

test('a default build detects an owned legacy vault instead of silently creating a second vault', async t=>{
  const root=await fixture(t,'security');
  await (await createEngine(root,{vaultName:'doc-vault'})).scan();
  const before=await hashes(root);
  await assert.rejects((await createEngine(root)).scan(),/migration|migrate/i);
  assert.deepEqual(await hashes(root),before);
  assert.equal(fs.existsSync(path.join(root,'edw-doc')),false);
});

test('a schema-one pre-standards vault refreshes additively and retains annotations', async t=>{
  const root=await fixture(t,'security'),engine=await createEngine(root);
  await engine.scan();
  const statePath=path.join(root,'edw-doc','.system','state.json');
  const old=JSON.parse(fs.readFileSync(statePath,'utf8'));
  old.version='0.1.0';delete old.standards;
  for(const entry of Object.values(old.enrichments))delete entry.standards_hash;
  fs.writeFileSync(statePath,JSON.stringify(old));
  const annotations=path.join(root,'edw-doc','annotations');
  fs.mkdirSync(annotations,{recursive:true});fs.writeFileSync(path.join(annotations,'owner.md'),'Keep this observation.\n');
  assert.equal((await engine.status()).fresh,false);
  await engine.refresh();
  assert.equal((await engine.status()).fresh,true);
  assert.equal(fs.readFileSync(path.join(annotations,'owner.md'),'utf8'),'Keep this observation.\n');
  const rules=await engine.standards({path:'src/safe.js'});
  assert.ok(rules.rules.length>0);
  assert.ok(rules.rules.every(r=>r.assessment.result==='not-assessed'));
  const note=await sourceNote(engine,'src/safe.js');
  assert.match(note.text,/\[\[standards\/[^\n]+\\\|/,'Obsidian aliases inside tables must escape the pipe');
  assert.equal((await engine.lint()).ok,true);
});
