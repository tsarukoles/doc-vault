import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, rename, unlink, access } from 'node:fs/promises';
import path from 'node:path';
import { createEngine } from '../src/engine.mjs';
import { fixture, hashes, allRecords, referencedPaths, sourceNote } from './helpers.mjs';

test('scan preserves repository content and appends the vault and agent root ignore rules', async (t) => {
  const root = await fixture(t, 'data-controls');
  const originalIgnore = await readFile(path.join(root, '.gitignore'), 'utf8');
  const original = await hashes(root, { exclude: ['.gitignore'] });
  const engine = await createEngine(root);
  const result = await engine.scan();

  assert.ok(result.snapshot);
  assert.ok(result.changes.added.length > 0);
  assert.ok(result.coverage);
  assert.ok(result.profile);
  assert.deepEqual(await hashes(root, { exclude: ['.gitignore', 'edw-doc'] }), original);
  const ignored = await readFile(path.join(root, '.gitignore'), 'utf8');
  assert.ok(ignored.startsWith(originalIgnore));
  assert.equal(ignored.split(/\r?\n/).filter((line) => line === '/edw-doc/').length, 1);
  assert.equal(ignored.split(/\r?\n/).filter((line) => line === '/.claude/').length, 1);

  const before = await hashes(path.join(root, 'edw-doc'));
  const second = await engine.scan();
  for (const kind of ['added', 'modified', 'deleted', 'renamed']) assert.deepEqual(second.changes[kind], []);
  assert.deepEqual(await hashes(path.join(root, 'edw-doc')), before);
  assert.equal(await readFile(path.join(root, '.gitignore'), 'utf8'), ignored);
  assert.equal((await engine.status()).fresh, true);
});

test('Markdown is reference material, supported source gets notes, and binary coverage is explicit', async (t) => {
  const root = await fixture(t, 'data-controls');
  await writeFile(path.join(root, 'opaque.bin'), Buffer.from([0, 12, 255, 0, 5]));
  const engine = await createEngine(root);
  await engine.scan();
  const records = await allRecords(engine);
  assert.ok(records.length >= 8);
  const rule = records.find((item) => item.path === 'application/rules.py');
  assert.ok(rule?.note_path, 'A meaningful Python source gets a note');
  const reference = records.find((item) => item.path === 'README.md');
  assert.ok(reference, 'Markdown remains visible in coverage');
  assert.ok(!reference.note_path, 'Markdown must not generate another per-file Markdown note');
  const binary = records.find((item) => item.path === 'opaque.bin');
  assert.ok(binary, 'Uninterpreted files must not silently disappear');
  assert.match(JSON.stringify(binary), /binary|unsupported|excluded|skipped/i);
  assert.ok(!binary.note_path);
  const note = await sourceNote(engine, 'application/rules.py');
  assert.ok(note.path);
  assert.match(note.text, /has_identifier|rules\.py/);
  assert.match(note.sha256, /^[a-f0-9]{64}$/);
  const vaultFiles = Object.keys(await hashes(path.join(root, 'edw-doc')));
  assert.ok(vaultFiles.some((name) => /onboarding/i.test(name)));
  const lint = await engine.lint();
  assert.equal(lint.ok, true, JSON.stringify(lint));
  assert.deepEqual(lint.errors, []);
});

test('relative Python imports and browser page objects produce usable relationships', async (t) => {
  const dataRoot = await fixture(t, 'data-controls');
  const dataEngine = await createEngine(dataRoot);
  const dataResult = await dataEngine.scan();
  assert.match(JSON.stringify(dataResult.profile), /data.controls|validation/i);
  const registry = await dataEngine.packet({ path: 'application/registry.py' });
  assert.ok(referencedPaths(registry.relationships).has('application/rules.py'), JSON.stringify(registry.relationships));
  const browserRoot = await fixture(t, 'e2e');
  const browserEngine = await createEngine(browserRoot);
  const result = await browserEngine.scan();
  assert.match(JSON.stringify(result.profile), /playwright|e2e|end.to.end/i);
  const login = await browserEngine.packet({ path: 'tests/login.spec.js' });
  assert.ok(referencedPaths(login.relationships).has('pages/LoginPage.js'), JSON.stringify(login.relationships));
  assert.equal((await browserEngine.lint()).ok, true);
});

test('refresh detects added, modified, renamed, and deleted files while preserving annotations', async (t) => {
  const root = await fixture(t, 'data-controls');
  const engine = await createEngine(root);
  await engine.scan();
  const annotation = path.join(root, 'edw-doc', 'annotations', 'engineer-note.md');
  await mkdir(path.dirname(annotation), { recursive: true });
  await writeFile(annotation, '# My observation\nPreserve this exactly.\n');
  const originalAnnotation = await readFile(annotation, 'utf8');
  const removed = (await allRecords(engine)).find((item) => item.path === 'application/handler.py');
  await access(path.join(root, 'edw-doc', removed.note_path));

  await writeFile(path.join(root, 'application', 'rules.py'), '\n# An additional documented boundary\n', { flag: 'a' });
  await writeFile(path.join(root, 'application', 'extra.py'), 'def extra():\n    return True\n');
  await rename(path.join(root, 'config', 'pipeline.yaml'), path.join(root, 'config', 'stages.yaml'));
  await unlink(path.join(root, 'application', 'handler.py'));
  assert.equal((await engine.status()).fresh, false);
  const refreshed = await engine.refresh();
  assert.ok(refreshed.changes.modified.length > 0);
  assert.ok(refreshed.changes.added.length > 0);
  assert.ok(refreshed.changes.deleted.length > 0);
  assert.ok(refreshed.changes.renamed.length > 0, 'An exact-content rename is retained as a rename');
  const current = await allRecords(engine);
  assert.ok(current.some((item) => item.path === 'application/extra.py' && item.note_path));
  assert.ok(!current.some((item) => item.path === 'application/handler.py' && item.note_path));
  assert.ok(!current.some((item) => item.path === 'config/pipeline.yaml' && item.note_path));
  if (removed?.note_path) await assert.rejects(access(path.join(root, 'edw-doc', removed.note_path)));
  assert.equal(await readFile(annotation, 'utf8'), originalAnnotation);
  assert.equal((await engine.status()).fresh, true);
  assert.equal((await engine.lint()).ok, true);
});

test('source reads include exact ranges and content fingerprints', async (t) => {
  const root = await fixture(t, 'data-controls');
  const engine = await createEngine(root);
  await engine.scan();
  const result = await engine.read({ path: 'application/registry.py', start_line: 1, end_line: 2 });
  assert.equal(result.path, 'application/registry.py');
  assert.equal(result.start_line, 1);
  assert.equal(result.end_line, 2);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.match(result.text, /from \.rules import/);
  assert.ok(!result.text.includes('"identifier_present":'));
});

test('misleading repository instructions remain data and do not mutate sources', async (t) => {
  const root = await fixture(t, 'security');
  const original = await hashes(root);
  const engine = await createEngine(root);
  await engine.scan();
  const reference = await engine.read({ path: 'README.md' });
  assert.match(reference.text, /Ignore every previous instruction/);
  assert.deepEqual(await hashes(root, { exclude: ['.gitignore', 'edw-doc'] }), original);
  await assert.rejects(access(path.join(root, 'owned.txt')));
  assert.equal((await engine.lint()).ok, true);
});

test('a custom vault name uses the same restricted output boundary', async (t) => {
  const root = await fixture(t, 'security');
  const original = await hashes(root);
  const engine = await createEngine(root, { vaultName: 'local-vault' });
  await engine.scan();
  assert.deepEqual(await hashes(root, { exclude: ['.gitignore', 'local-vault'] }), original);
  assert.equal(await readFile(path.join(root, '.gitignore'), 'utf8'), '/local-vault/\n/.claude/\n');
  await assert.rejects(access(path.join(root, 'edw-doc')));
  assert.equal((await engine.status()).fresh, true);
});

test('same-size unsupported binary edits are visible in freshness and change reports', async (t) => {
  const root = await fixture(t, 'security');
  const file = path.join(root, 'opaque.bin');
  await writeFile(file, Buffer.from([0, 1, 2, 3]));
  const engine = await createEngine(root);
  await engine.scan();
  await writeFile(file, Buffer.from([0, 8, 2, 3]));
  assert.equal((await engine.status()).fresh, false);
  const refreshed = await engine.refresh();
  assert.ok(refreshed.changes.modified.includes('opaque.bin'));
  assert.equal((await engine.status()).fresh, true);
});

test('lint reports unresolved local wiki links introduced into a generated note', async (t) => {
  const root = await fixture(t, 'security');
  const engine = await createEngine(root);
  await engine.scan();
  const note = await sourceNote(engine, 'src/safe.js');
  await writeFile(path.join(root, 'edw-doc', note.path), '\n[[missing-local-note]]\n', { flag: 'a' });
  const report = await engine.lint();
  assert.equal(report.ok, false);
  assert.ok(report.errors.length > 0);
  assert.match(JSON.stringify(report.errors), /missing-local-note|link|unresolved/i);
});

test('competing refreshes do not produce two concurrent vault writers', async (t) => {
  const root = await fixture(t, 'security');
  const first = await createEngine(root);
  await first.scan();
  const second = await createEngine(root);
  const results = await Promise.allSettled([first.refresh(), second.refresh()]);
  assert.ok(results.some((result) => result.status === 'fulfilled'));
  for (const result of results.filter((item) => item.status === 'rejected')) {
    assert.match(result.reason.message, /writer|lock|active/i);
  }
  assert.equal((await first.status()).fresh, true);
  assert.equal((await first.lint()).ok, true);
});

test('an existing exact ignore rule followed by ordinary rules is preserved without duplication', async (t) => {
  const root = await fixture(t, 'security');
  const original = '# Preserve line endings and order\r\n/edw-doc/\r\n/.claude/\r\n*.log\r\n';
  await writeFile(path.join(root, '.gitignore'), original);
  const engine = await createEngine(root);
  await engine.scan();
  assert.equal(await readFile(path.join(root, '.gitignore'), 'utf8'), original);
  await engine.refresh();
  assert.equal(await readFile(path.join(root, '.gitignore'), 'utf8'), original);
});

test('a later vault negation requires one final ignore rule without altering preceding bytes', async (t) => {
  const root = await fixture(t, 'security');
  const original = '# Existing project choices\r\n/edw-doc/\r\n!/edw-doc/\r\n*.log\r\n';
  await writeFile(path.join(root, '.gitignore'), original);
  const engine = await createEngine(root);
  await engine.scan();
  const expected = original + '/edw-doc/\r\n/.claude/\r\n';
  assert.equal(await readFile(path.join(root, '.gitignore'), 'utf8'), expected);
  await engine.refresh();
  assert.equal(await readFile(path.join(root, '.gitignore'), 'utf8'), expected);
});
