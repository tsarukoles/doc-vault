import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createEngine } from '../src/engine.mjs';
import { fixture, sourceNote, allRecords } from './helpers.mjs';

async function evidence(engine, sourcePath) {
  const source = await engine.read({ path: sourcePath, start_line: 1, end_line: 1 });
  return { path: source.path, sha256: source.sha256, start_line: 1, end_line: 1 };
}

async function inputFor(engine, sourcePath, text = 'Evidence-backed source analysis.', extra = {}) {
  return {
    kind: 'file', title: 'Example source explanation', summary: 'An explanation grounded in the inspected source.',
    source_paths: [sourcePath],
    sections: [{ heading: 'Analysis', text, evidence: [await evidence(engine, sourcePath)] }],
    ...extra,
  };
}

test('changing a source cited only by a reviewer invalidates that supporting review', async (t) => {
  const root = await fixture(t, 'data-controls');
  const engine = await createEngine(root);
  await engine.scan();
  await engine.publish(await inputFor(engine, 'application/registry.py'));
  const original = await sourceNote(engine, 'application/registry.py');
  await engine.review({
    note_path: original.path, expected_note_sha256: original.sha256,
    verdict: 'supported', reason: 'Reviewed using the additional pipeline configuration.',
    evidence: [await evidence(engine, 'config/pipeline.yaml')],
  });
  assert.equal((await engine.note({ path: original.path })).review.verdict, 'supported');
  await writeFile(path.join(root, 'config', 'pipeline.yaml'), '\n# Configuration changed after review\n', { flag: 'a' });
  await engine.refresh();
  const current = await sourceNote(engine, 'application/registry.py');
  assert.notEqual(current.review?.verdict, 'supported', 'A review must not outlive the source evidence it checked');
  assert.equal((await engine.lint()).ok, true);
});

test('a new review is refused while the repository inventory is stale', async (t) => {
  const root = await fixture(t, 'data-controls');
  const engine = await createEngine(root);
  await engine.scan();
  await engine.publish(await inputFor(engine, 'application/registry.py'));
  const original = await sourceNote(engine, 'application/registry.py');
  const currentEvidence = await evidence(engine, 'application/registry.py');
  await writeFile(path.join(root, 'application', 'new_module.py'), 'def newly_added():\n    return True\n');
  assert.equal((await engine.status()).fresh, false);
  await assert.rejects(engine.review({
    note_path: original.path, expected_note_sha256: original.sha256,
    verdict: 'supported', reason: 'The source itself did not change, but inventory is stale.',
    evidence: [currentEvidence],
  }), /fresh|stale|changed|scan|sync|snapshot|inventory/i);
  assert.notEqual((await engine.note({ path: original.path })).review?.verdict, 'supported');
});

test('a new incoming consumer invalidates an enriched file neighborhood', async (t) => {
  const root = await fixture(t, 'data-controls');
  const engine = await createEngine(root);
  await engine.scan();
  const marker = 'Previously analyzed consumer neighborhood.';
  await engine.publish(await inputFor(engine, 'application/registry.py', marker));
  const before = await sourceNote(engine, 'application/registry.py');
  await writeFile(path.join(root, 'application', 'new_consumer.py'), 'from .registry import CONTROLS\n\ndef select_control(name):\n    return CONTROLS[name]\n');
  const refresh = await engine.refresh();
  assert.ok(refresh.invalidated_notes >= 1);
  const after = await sourceNote(engine, 'application/registry.py');
  assert.notEqual(after.sha256, before.sha256);
  assert.ok(!after.text.includes(marker), 'Old neighborhood analysis must not remain current when new incoming edges appear');
  assert.equal((await engine.lint()).ok, true);
});

test('an inventory addition invalidates aggregate onboarding, profile, and component maps', async (t) => {
  const root = await fixture(t, 'data-controls');
  const engine = await createEngine(root);
  await engine.scan();
  const published = [];
  for (const kind of ['onboarding', 'profile', 'component']) {
    const marker = `Complete repository overview before the addition: ${kind}.`;
    const input = await inputFor(engine, 'application/registry.py', marker, { kind, slug: `example-${kind}` });
    published.push({ ...(await engine.publish(input)), marker });
  }
  await writeFile(path.join(root, 'application', 'new_capability.py'), 'def newly_discovered_capability():\n    return "example"\n');
  const result = await engine.refresh();
  assert.ok(result.invalidated_notes >= 3);
  for (const note of published) {
    const current = await engine.note({ path: note.path });
    assert.ok(!current.text.includes(note.marker), `The ${note.path} aggregate must be reconsidered after inventory expansion`);
    assert.match(current.text, /stale|refresh|retired|unresolved/i);
  }
  assert.equal((await engine.lint()).ok, true);
});

test('deleting a wiki-linked target invalidates the referring enrichment without blocking sync', async (t) => {
  const root = await fixture(t, 'data-controls');
  const engine = await createEngine(root);
  await engine.scan();
  const target = (await allRecords(engine)).find((item) => item.path === 'application/handler.py').note_path.replace(/\.md$/, '');
  const marker = `Related navigation: [[${target}|Handler explanation]].`;
  await engine.publish(await inputFor(engine, 'config/pipeline.yaml', marker));
  assert.equal((await engine.lint()).ok, true);
  await unlink(path.join(root, 'application', 'handler.py'));
  const refreshed = await engine.refresh();
  assert.ok(refreshed.invalidated_notes >= 1);
  const current = await sourceNote(engine, 'config/pipeline.yaml');
  assert.ok(!current.text.includes(marker));
  assert.equal((await engine.status()).fresh, true);
  assert.equal((await engine.lint()).ok, true);
});

test('the managed publisher rejects HTML embeds and Markdown image syntaxes', async (t) => {
  const root = await fixture(t, 'security');
  const engine = await createEngine(root);
  await engine.scan();
  const original = await sourceNote(engine, 'src/safe.js');
  const inputs = [
    '<img src="https://example.invalid/image.png">',
    '<video src="//example.invalid/movie.mp4"></video>',
    '<audio src="//example.invalid/audio.mp3"></audio>',
    '<iframe src="https://example.invalid/"></iframe>',
    '<object data="https://example.invalid/object"></object>',
    '<svg onload="example()"></svg>',
    '![remote](https://example.invalid/image.png)',
    '![protocol-relative](//example.invalid/image.png)',
    '![local](../outside.png)',
    '![data](data:image/png;base64,AA==)',
    '![reference][picture]\n\n[picture]: https://example.invalid/image.png',
    '![shortcut]\n\n[shortcut]: ../outside.png',
    '![collapsed][]\n\n[collapsed]: ../outside.png',
  ];
  for (const text of inputs) {
    await assert.rejects(engine.publish(await inputFor(engine, 'src/safe.js', text)), /image|embed|HTML|markup|allowed|unsafe/i, text);
  }
  const summaryImage = await inputFor(engine, 'src/safe.js', 'An ordinary section.', { summary: '![image](//example.invalid/image.png)' });
  await assert.rejects(engine.publish(summaryImage), /image|embed|HTML|markup|allowed|unsafe/i);
  assert.equal((await sourceNote(engine, 'src/safe.js')).sha256, original.sha256);
  assert.equal((await engine.lint()).ok, true);
});

test('wiki-like bracket characters in source filenames do not break baseline generation or lint', async (t) => {
  const root = await fixture(t, 'security');
  const sourcePath = 'src/reader[[example]].js';
  await writeFile(path.join(root, sourcePath), 'export function exampleReader() { return true; }\n');
  const engine = await createEngine(root);
  await engine.scan();
  const note = await sourceNote(engine, sourcePath);
  assert.ok(note.path);
  assert.match(note.text, /exampleReader/);
  const report = await engine.lint();
  assert.equal(report.ok, true, JSON.stringify(report));
  assert.equal((await engine.status()).fresh, true);
});

test('the analysis index links published explanations and keeps their review status current', async (t) => {
  const root = await fixture(t, 'data-controls');
  const engine = await createEngine(root);
  await engine.scan();
  assert.match((await engine.note({ path: 'index.md' })).text, /\[\[analysis-index(?:\||\]\])/);
  const flow = await engine.publish(await inputFor(engine, 'application/registry.py', 'A source-grounded example flow.', { kind: 'flow', slug: 'example-flow' }));
  const profile = await engine.publish(await inputFor(engine, 'application/metadata.py', 'A source-grounded example profile.', { kind: 'profile', slug: 'example-profile' }));
  const target = (published) => published.path.replace(/\.md$/, '');
  const beforeReview = await engine.note({ path: 'analysis-index.md' });
  for (const published of [flow, profile]) {
    assert.ok(beforeReview.text.includes(`[[${target(published)}`), `Missing index navigation for ${published.path}`);
  }
  const note = await engine.note({ path: flow.path });
  await engine.review({
    note_path: note.path, expected_note_sha256: note.sha256,
    verdict: 'supported', reason: 'Checked the current registry declaration.',
    evidence: [await evidence(engine, 'application/registry.py')],
  });
  const reviewed = await engine.note({ path: 'analysis-index.md' });
  assert.notEqual(reviewed.sha256, beforeReview.sha256);
  assert.match(reviewed.text, /supported/i);
  await writeFile(path.join(root, 'application', 'registry.py'), '\n# Updated after review\n', { flag: 'a' });
  await engine.refresh();
  const refreshed = await engine.note({ path: 'analysis-index.md' });
  const oldFlowRows = refreshed.text.split(/\r?\n/).filter((line) => line.includes(target(flow)));
  assert.ok(oldFlowRows.every((line) => !/supported/i.test(line)), 'Navigation must not advertise a stale supporting review');
  assert.notEqual((await engine.note({ path: flow.path })).review?.verdict, 'supported');
  assert.equal((await engine.lint()).ok, true);
});

test('invalidated analysis remains queued across unchanged refreshes until fresh republication', async (t) => {
  const root = await fixture(t, 'data-controls');
  const engine = await createEngine(root);
  await engine.scan();
  const flowInput = () => inputFor(engine, 'application/registry.py', 'A source-grounded flow explanation.', { kind: 'flow', slug: 'queued-flow' });
  const published = await engine.publish(await flowInput());
  assert.equal((await engine.status()).pending_analysis, 0);
  await writeFile(path.join(root, 'application', 'registry.py'), '\n# Source changed during normal development\n', { flag: 'a' });
  const changed = await engine.refresh();
  assert.ok(changed.invalidated_note_paths.includes(published.path));
  const firstEntry = (await engine.list({ kind: 'notes', limit: 500 })).items.find((item) => item.path === published.path);
  assert.ok(firstEntry?.needs_analysis, 'Notes listing must expose the analysis still needed after static refresh');
  assert.ok((await engine.note({ path: published.path })).needs_analysis);
  assert.equal((await engine.status()).pending_analysis, 1);

  await engine.refresh();
  const secondEntry = (await engine.list({ kind: 'notes', limit: 500 })).items.find((item) => item.path === published.path);
  assert.deepEqual(secondEntry.needs_analysis, firstEntry.needs_analysis, 'An unchanged scan must not erase or recreate the pending analysis request');
  assert.equal((await engine.status()).pending_analysis, 1);

  await engine.publish(await flowInput());
  const currentEntry = (await engine.list({ kind: 'notes', limit: 500 })).items.find((item) => item.path === published.path);
  assert.equal(currentEntry.needs_analysis, null);
  assert.equal((await engine.note({ path: published.path })).needs_analysis, null);
  assert.equal((await engine.status()).pending_analysis, 0);
  assert.equal((await engine.lint()).ok, true);
});

test('Python declaration evidence points at declarations rather than preceding blank lines', async (t) => {
  const root = await fixture(t, 'security');
  const sourcePath = 'src/declared.py';
  const lines = [
    '"""Synthetic declarations with deliberately separated blocks."""',
    '',
    '',
    'def first():',
    '    return 1',
    '',
    '',
    'class Second:',
    '    pass',
    '',
    'async def third():',
    '    return 3',
    '',
  ];
  await writeFile(path.join(root, sourcePath), lines.join('\n'));
  const engine = await createEngine(root);
  await engine.scan();
  const packet = await engine.packet({ path: sourcePath });
  const declarations = new Map(packet.facts.symbols.map((symbol) => [symbol.name, symbol]));
  for (const [name, expectedLine] of [['first', 4], ['Second', 8], ['third', 11]]) {
    const declaration = declarations.get(name);
    assert.ok(declaration, `Missing declaration ${name}`);
    assert.equal(declaration.line, expectedLine);
    const source = await engine.read({ path: sourcePath, start_line: declaration.line, end_line: declaration.line });
    assert.ok(source.text.includes(name));
  }
  assert.equal(packet.facts.facts[0].line, 4);
});
