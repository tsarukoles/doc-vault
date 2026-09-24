import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createEngine } from '../src/engine.mjs';
import { temporaryDirectory, sourceNote } from './helpers.mjs';
import { evaluationPacket, gradePredictions } from '../scripts/evaluate.mjs';

async function setup(t) {
  const root = await temporaryDirectory(t, 'doc-vault-standards-');
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'src', 'threshold.py'), 'def accepts_batch(count):\n    return count > 3\n');
  await writeFile(path.join(root, 'src', 'unrelated.py'), 'def label():\n    return "fixture"\n');
  await writeFile(path.join(root, 'POLICY.md'), '# Batch contract\nAccept a count of at least 3.\n');
  const engine = await createEngine(root, { vaultName: 'edw-doc' });
  await engine.scan();
  return { root, engine };
}

async function evidence(engine, sourcePath, start = 1, end = start) {
  const source = await engine.read({ path: sourcePath, start_line: start, end_line: end });
  return { path: source.path, sha256: source.sha256, start_line: start, end_line: end };
}

async function projectRule(engine, overrides = {}) {
  return {
    id: 'project-minimum-count', category: 'transformations',
    title: 'Minimum record count', requirement: 'Accept counts of at least 3.',
    rationale: 'The supplied batch contract includes the boundary value.',
    verification: 'Compare the acceptance branch with the contract.',
    authority: 'declared',
    scope: { languages: [], kinds: [], paths: ['src/threshold.py'] },
    evidence: [await evidence(engine, 'POLICY.md', 1, 2)],
    ...overrides,
  };
}

async function ruleFor(engine, id, sourcePath = 'src/threshold.py') {
  const response = await engine.standards({ path: sourcePath, limit: 100 });
  const rule = response.rules.find((item) => item.id === id);
  assert.ok(rule, `Expected candidate rule ${id}`);
  return rule;
}

async function assessmentInput(engine, rule, overrides = {}) {
  const ownEvidence = await evidence(engine, 'src/threshold.py', 1, 2);
  return {
    path: ownEvidence.path,
    expected_source_sha256: ownEvidence.sha256,
    assessments: [{
      rule_id: rule.id, rule_hash: rule.hash,
      result: 'noncompliant',
      rationale: 'A count of exactly 3 is rejected by the strict comparison, contrary to the declared boundary.',
      evidence: [ownEvidence, await evidence(engine, 'POLICY.md', 1, 2)],
      ...overrides,
    }],
  };
}

test('standards start unassessed and link files to rule pages in both directions', async (t) => {
  const { engine } = await setup(t);
  const rule = await ruleFor(engine, 'python-exception-intent');
  assert.equal(rule.assessment.result, 'not-assessed');
  assert.match(rule.hash, /^[a-f0-9]{64}$/);
  const note = await sourceNote(engine, 'src/threshold.py');
  assert.ok(note.text.includes(`[[${rule.note_path.replace(/\.md$/, '')}`), 'A file note links to its standards page.');
  const standard = await engine.note({ path: rule.note_path });
  assert.ok(standard.text.includes(`[[${note.path.replace(/\.md$/, '')}`), 'A standards page links back to candidate source notes.');
  assert.equal((await engine.lint()).ok, true);
});

test('declared rules accept source-backed noncompliance and scope avoids unrelated files', async (t) => {
  const { engine } = await setup(t);
  await engine.rule(await projectRule(engine));
  const rule = await ruleFor(engine, 'project-minimum-count');
  await engine.assess(await assessmentInput(engine, rule));
  const assessed = await ruleFor(engine, rule.id);
  assert.equal(assessed.assessment.result, 'noncompliant');
  assert.notEqual(assessed.assessment.freshness, 'stale');
  const unrelated = await engine.standards({ path: 'src/unrelated.py', limit: 100 });
  assert.ok(!unrelated.rules.some((item) => item.id === rule.id));
  const note = await sourceNote(engine, 'src/threshold.py');
  assert.match(note.text, /noncompliant/);
  assert.match(note.text, /exactly 3/);
  assert.equal((await engine.lint()).ok, true);
});

test('source changes make an assessment unassessed with its stale previous outcome retained', async (t) => {
  const { root, engine } = await setup(t);
  await engine.rule(await projectRule(engine));
  const rule = await ruleFor(engine, 'project-minimum-count');
  await engine.assess(await assessmentInput(engine, rule));
  await writeFile(path.join(root, 'src', 'threshold.py'), 'def accepts_batch(count):\n    return count >= 3\n');
  await engine.refresh();
  const updated = await ruleFor(engine, rule.id);
  assert.equal(updated.assessment.result, 'not-assessed');
  assert.equal(updated.assessment.freshness, 'stale');
  assert.equal(updated.assessment.previous_result, 'noncompliant');
});

test('a changed authority source invalidates an assessment even when code is unchanged', async (t) => {
  const { root, engine } = await setup(t);
  await engine.rule(await projectRule(engine));
  const rule = await ruleFor(engine, 'project-minimum-count');
  await engine.assess(await assessmentInput(engine, rule));
  await writeFile(path.join(root, 'POLICY.md'), '# Batch contract\nAccept only counts greater than 3.\n');
  await engine.refresh();
  const updated = await ruleFor(engine, rule.id);
  assert.equal(updated.freshness, 'stale');
  assert.equal(updated.assessment.result, 'not-assessed');
  assert.equal(updated.assessment.freshness, 'stale');
});

test('assessment rejects missing, unrelated, forged, and stale evidence without replacing a valid result', async (t) => {
  const { engine } = await setup(t);
  await engine.rule(await projectRule(engine));
  const rule = await ruleFor(engine, 'project-minimum-count');
  await engine.assess(await assessmentInput(engine, rule));
  const before = await sourceNote(engine, 'src/threshold.py');
  for (const badEvidence of [
    [],
    [await evidence(engine, 'POLICY.md', 1, 2)],
    [await evidence(engine, 'src/unrelated.py', 1, 2)],
    [{ ...(await evidence(engine, 'src/threshold.py', 1, 2)), sha256: '0'.repeat(64) }],
    [{ ...(await evidence(engine, 'src/threshold.py', 1, 2)), end_line: 9999 }],
  ]) await assert.rejects(engine.assess(await assessmentInput(engine, rule, { evidence: badEvidence })));
  const stale = await assessmentInput(engine, rule);
  stale.expected_source_sha256 = '0'.repeat(64);
  await assert.rejects(engine.assess(stale));
  await assert.rejects(engine.assess(await assessmentInput(engine, rule, { rule_hash: '0'.repeat(64) })));
  assert.equal((await sourceNote(engine, 'src/threshold.py')).sha256, before.sha256);
  assert.equal((await ruleFor(engine, rule.id)).assessment.result, 'noncompliant');
});

test('advisory and observed-convention rules cannot become mandatory violations', async (t) => {
  const { engine } = await setup(t);
  const advisory = await ruleFor(engine, 'python-exception-intent');
  await assert.rejects(engine.assess(await assessmentInput(engine, advisory)));
  await engine.rule(await projectRule(engine, { authority: 'convention' }));
  const convention = await ruleFor(engine, 'project-minimum-count');
  await assert.rejects(engine.assess(await assessmentInput(engine, convention)));
  await engine.assess(await assessmentInput(engine, convention, { result: 'diverges' }));
  assert.equal((await ruleFor(engine, convention.id)).assessment.result, 'diverges');
});

test('rule publication rejects invalid scope, missing authority evidence, and builtin replacement', async (t) => {
  const { engine } = await setup(t);
  for (const overrides of [
    { scope: { languages: [], kinds: [], paths: ['../outside'] } },
    { scope: { languages: [], kinds: [], paths: ['C:/outside'] } },
    { scope: { languages: [], kinds: [], paths: ['src\\threshold.py'] } },
    { scope: {} },
    { evidence: [] },
    { evidence: [{ ...(await evidence(engine, 'POLICY.md', 1, 2)), sha256: '0'.repeat(64) }] },
    { authority: 'mandatory-because-agent-said-so' },
    { id: 'python-exception-intent' },
  ]) await assert.rejects(engine.rule(await projectRule(engine, overrides)));
  assert.ok(!(await engine.standards({ limit: 100 })).rules.some((item) => item.id === 'project-minimum-count'));
});

test('not-applicable and unknown assessments need explanations and inspected source evidence', async (t) => {
  const { engine } = await setup(t);
  const rule = await ruleFor(engine, 'python-exception-intent');
  await assert.rejects(engine.assess(await assessmentInput(engine, rule, { result: 'not-applicable', rationale: '' })));
  await assert.rejects(engine.assess(await assessmentInput(engine, rule, { result: 'unknown', evidence: [] })));
  await engine.assess(await assessmentInput(engine, rule, { result: 'not-applicable', rationale: 'The complete inspected function contains no exception handler.' }));
  assert.equal((await ruleFor(engine, rule.id)).assessment.result, 'not-applicable');
});

test('editing a rule invalidates its previous assessment and supporting file-note review', async (t) => {
  const { engine } = await setup(t);
  const definition = await projectRule(engine);
  await engine.rule(definition);
  const rule = await ruleFor(engine, definition.id);
  await engine.assess(await assessmentInput(engine, rule));
  const before = await sourceNote(engine, 'src/threshold.py');
  await engine.review({ note_path: before.path, expected_note_sha256: before.sha256, verdict: 'supported', reason: 'The source and cited rule support this assessment.', evidence: [await evidence(engine, 'src/threshold.py', 1, 2), await evidence(engine, 'POLICY.md', 1, 2)] });
  assert.equal((await engine.note({ path: before.path })).review.verdict, 'supported');
  await engine.rule({ ...definition, verification: 'Inspect the boundary comparison and explicitly describe the count of exactly 3.' });
  const updated = await ruleFor(engine, definition.id);
  assert.notEqual(updated.hash, rule.hash);
  assert.equal(updated.assessment.result, 'not-assessed');
  assert.equal(updated.assessment.freshness, 'stale');
  assert.notEqual((await sourceNote(engine, 'src/threshold.py')).review?.verdict, 'supported');
});

async function syntheticPredictions() {
  const packet = evaluationPacket();
  const rubric = JSON.parse(await readFile(new URL('../evaluations/rubric.json', import.meta.url), 'utf8'));
  return {
    model: 'synthetic-grader-test', provider: 'none', plugin_version: packet.plugin_version, run_at: '2026-09-23T12:00:00.000Z',
    cases: rubric.cases.map((expected) => {
      const input = packet.cases.find((item) => item.id === expected.id);
      return {
        id: expected.id, rule_id: input.rule_id, result: expected.result, finding: expected.finding,
        rationale: 'Synthetic data validates grading mechanics only; this is not a model-generated explanation.',
        evidence: expected.required_evidence.map((anchor) => ({ ...anchor, sha256: input.files.find((file) => file.path === anchor.path).sha256 })),
      };
    }),
  };
}

test('semantic packets omit grader answers and contain complete inspectable source hashes', () => {
  const packet = evaluationPacket();
  assert.equal(packet.cases.length, 6);
  for (const item of packet.cases) {
    assert.ok(!Object.hasOwn(item, 'result'));
    assert.ok(!Object.hasOwn(item, 'human_review'));
    assert.ok(!Object.hasOwn(item, 'required_evidence'));
    assert.ok(item.files.length > 0);
    for (const file of item.files) assert.match(file.sha256, /^[a-f0-9]{64}$/);
  }
  assert.equal(evaluationPacket('minimum-count').cases.length, 1);
  assert.throws(() => evaluationPacket('../rubric'));
});

test('synthetic answer-key records validate grader mechanics without claiming model quality', async () => {
  const result = gradePredictions(await syntheticPredictions());
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.totals.deterministic_cases_passed, 6);
  assert.equal(result.human_review_required, true);
  assert.match(result.limitation, /does not establish/);
});

test('semantic grader detects false positives, missed defects, invented evidence, and duplicate cases', async () => {
  const clean = await syntheticPredictions();
  for (const mutate of [
    (input) => { input.cases[0].result = 'complies'; input.cases[0].finding = 'absent'; },
    (input) => { input.cases[1].result = 'noncompliant'; input.cases[1].finding = 'present'; },
    (input) => { input.cases[0].evidence[0].sha256 = '0'.repeat(64); },
    (input) => { input.cases[0].evidence[0].path = '../outside'; },
    (input) => { input.cases[0].evidence[0].end_line = 99999; },
    (input) => { input.cases[0].evidence = []; },
    (input) => { input.cases.push(input.cases[0]); },
    (input) => { input.cases.pop(); },
  ]) {
    const input = structuredClone(clean);
    mutate(input);
    assert.equal(gradePredictions(input).ok, false);
  }
});
