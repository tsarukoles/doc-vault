import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createEngine } from '../src/engine.mjs';
import { temporaryDirectory, hashes } from './helpers.mjs';

async function sourceEvidence(engine, sourcePath, endLine) {
  const source=await engine.read({path:sourcePath,start_line:1,end_line:endLine});
  return {path:source.path,sha256:source.sha256,start_line:1,end_line:endLine};
}

async function assessedFixture(t) {
  const root=await temporaryDirectory(t,'edw-doc-standards-regression-');
  await mkdir(path.join(root,'src'));
  await writeFile(path.join(root,'POLICY.md'),'# Acceptance contract\nAccept values of at least three.\n');
  await writeFile(path.join(root,'src','checks.py'),'def valid(value):\n    return value >= 3\n');
  await writeFile(path.join(root,'src','service.py'),'from .checks import valid\n\ndef accept(value):\n    return valid(value)\n');
  const engine=await createEngine(root,{vaultName:'edw-doc'});
  await engine.scan();
  const definition={
    id:'acceptance-boundary',category:'transformations',title:'Minimum accepted value',
    requirement:'Accept values greater than or equal to three.',
    rationale:'The supplied contract includes the boundary value.',
    verification:'Trace acceptance through the local validation helper.',authority:'declared',
    scope:{paths:['src/service.py'],languages:[],kinds:[]},
    evidence:[await sourceEvidence(engine,'POLICY.md',2)],
  };
  await engine.rule(definition);
  const rule=(await engine.standards({path:'src/service.py'})).rules.find(item=>item.id===definition.id);
  const source=await sourceEvidence(engine,'src/service.py',4);
  // The broker must capture known dependencies even when the model supplies
  // only the assessed file as its explicit evidence.
  await engine.assess({path:source.path,expected_source_sha256:source.sha256,assessments:[{
    rule_id:rule.id,rule_hash:rule.hash,result:'complies',
    rationale:'The acceptance wrapper delegates the decision to the repository validation helper.',
    evidence:[source],
  }]});
  const before=await engine.status();
  assert.equal(before.standards.assessed,1);
  assert.equal(before.standards.stale,0);
  return {root,engine,ruleId:rule.id,originalSourceHash:source.sha256};
}

async function assessmentFor(engine,ruleId) {
  const item=(await engine.standards({path:'src/service.py'})).rules.find(rule=>rule.id===ruleId);
  assert.ok(item,'The declared rule remains in the current catalog.');
  return item;
}

for(const changed of ['source','policy']) {
  test(`read-only status reports stale standards immediately after ${changed} changes, before sync`,async t=>{
    const {root,engine}=await assessedFixture(t);
    const vaultBefore=await hashes(path.join(root,'edw-doc'));
    if(changed==='source')await writeFile(path.join(root,'src','service.py'),'from .checks import valid\n\ndef accept(value):\n    return valid(value) and value > 3\n');
    else await writeFile(path.join(root,'POLICY.md'),'# Acceptance contract\nAccept only values greater than three.\n');
    const status=await engine.status();
    assert.equal(status.fresh,false);
    assert.equal(status.standards.assessed,0,'Saved results cannot count as current against changed working-copy evidence.');
    assert.ok(status.standards.stale>=1,'At least the formerly assessed rule is visibly stale.');
    assert.ok(status.standards['not-assessed']>=1);
    await assert.rejects(engine.packet({path:'src/service.py'}),/refresh|changed/i,'A packet cannot expose old current assessments before sync.');
    assert.deepEqual(await hashes(path.join(root,'edw-doc')),vaultBefore,'Status must not update or rewrite the vault.');
  });
}

test('changing a known dependency invalidates the unchanged caller assessment',async t=>{
  const {root,engine,ruleId,originalSourceHash}=await assessedFixture(t);
  await writeFile(path.join(root,'src','checks.py'),'def valid(value):\n    return value > 3\n');
  const live=await engine.status();
  assert.equal(live.standards.assessed,0,'A changed dependency is stale before publication of refreshed notes.');
  assert.ok(live.standards.stale>=1);
  await assert.rejects(engine.packet({path:'src/service.py'}),/refresh|changed/i,'An unchanged source cannot bypass a changed dependency through packet.');
  await engine.refresh();
  const ownSource=await sourceEvidence(engine,'src/service.py',4);
  assert.equal(ownSource.sha256,originalSourceHash,'The caller itself did not change.');
  const item=await assessmentFor(engine,ruleId);
  assert.equal(item.assessment.result,'not-assessed');
  assert.equal(item.assessment.freshness,'stale');
  assert.equal(item.assessment.previous_result,'complies');
});

test('adding an incoming consumer invalidates a file assessment without changing its source',async t=>{
  const {root,engine,ruleId,originalSourceHash}=await assessedFixture(t);
  await writeFile(path.join(root,'src','consumer.py'),'from .service import accept\n\ndef run(value):\n    return accept(value)\n');
  const live=await engine.status();
  assert.equal(live.standards.assessed,0,'A new incoming relationship requires the previous claim to be reconsidered.');
  assert.ok(live.standards.stale>=1);
  await engine.refresh();
  const packet=await engine.packet({path:'src/service.py'});
  assert.ok(packet.relationships.some(edge=>edge.from==='src/consumer.py'&&edge.to==='src/service.py'),'The fixture must establish a resolved incoming relationship.');
  assert.equal(packet.source.sha256,originalSourceHash);
  const item=await assessmentFor(engine,ruleId);
  assert.equal(item.assessment.result,'not-assessed');
  assert.equal(item.assessment.freshness,'stale');
  assert.equal(item.assessment.previous_result,'complies');
});
