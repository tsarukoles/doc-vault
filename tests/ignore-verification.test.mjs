import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { assertIgnoredOutputs, ignoreDiagnostics } from '../src/inventory.mjs';
import { ensureIgnore } from '../src/security.mjs';
import { hashes, temporaryDirectory } from './helpers.mjs';

const gitAvailable = spawnSync('git', ['--version'], { stdio:'ignore', windowsHide:true }).status === 0;
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding:'utf8', stdio:'pipe', windowsHide:true });
async function gitFixture(t) {
  const root = await temporaryDirectory(t, 'edw-doc-ignore-verification-');
  git(root, 'init', '--quiet', '--template=');
  return root;
}

test('Git verifies anchored output rules and reports the exact project and Git roots', { skip:!gitAvailable }, async t => {
  const root = await gitFixture(t);
  ensureIgnore(root, 'edw-doc');
  const before = await hashes(root);
  const report = assertIgnoredOutputs(root, 'edw-doc');
  assert.equal(report.git_verified, true);
  assert.equal(report.repository_root, root);
  assert.equal(path.resolve(report.git_root), root);
  assert.equal(report.output_paths['edw-doc/'], path.join(root, 'edw-doc/'));
  assert.deepEqual(report.effective_rules.map(item => [item.path, item.ignored, item.pattern]), [
    ['edw-doc/', true, '/edw-doc/'], ['.claude/', true, '/.claude/']
  ]);
  assert.deepEqual(await hashes(root), before, 'Verification does not write output probes or mutate Git');
});

test('a parent root ignore rule does not protect a nested project until its local ignore file is repaired', { skip:!gitAvailable }, async t => {
  const root = await gitFixture(t);
  ensureIgnore(root, 'edw-doc');
  const nested = path.join(root, 'project');
  fs.mkdirSync(nested);
  const before = ignoreDiagnostics(nested, 'edw-doc');
  assert.equal(before.repository_root, nested);
  assert.equal(path.resolve(before.git_root), root);
  assert.deepEqual(before.effective_rules.map(item => item.ignored), [false, false]);
  assert.throws(() => assertIgnoredOutputs(nested, 'edw-doc'), /Git ignore protection could not be verified/);
  ensureIgnore(nested, 'edw-doc');
  assert.equal(assertIgnoredOutputs(nested, 'edw-doc').git_verified, true);
  assert.equal(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), '/edw-doc/\n/.claude/\n', 'Parent patterns are not broadened');
});

test('a textual rule overridden by negation is diagnosed using Git and repaired by appending', { skip:!gitAvailable }, async t => {
  const root = await gitFixture(t);
  const original = '/edw-doc/\n/.claude/\n!/edw-doc/\n';
  fs.writeFileSync(path.join(root, '.gitignore'), original);
  const report = ignoreDiagnostics(root, 'edw-doc');
  assert.equal(report.git_verified, false);
  assert.deepEqual(report.effective_rules.map(item => item.ignored), [false, true]);
  assert.match(report.warnings.join(' '), /Git does not ignore/);
  assert.throws(() => assertIgnoredOutputs(root, 'edw-doc'), /Git does not ignore/);
  ensureIgnore(root, 'edw-doc');
  assert.equal(assertIgnoredOutputs(root, 'edw-doc').git_verified, true);
  assert.ok(fs.readFileSync(path.join(root, '.gitignore'), 'utf8').startsWith(original));
});

test('tracked vault files are separately reported and rejected despite matching ignore rules', { skip:!gitAvailable }, async t => {
  const root = await gitFixture(t);
  fs.mkdirSync(path.join(root, 'edw-doc'));
  fs.writeFileSync(path.join(root, 'edw-doc', 'index.md'), '# Existing vault\n');
  git(root, 'add', '--', 'edw-doc/index.md');
  ensureIgnore(root, 'edw-doc');
  const before = await hashes(root);
  const report = ignoreDiagnostics(root, 'edw-doc');
  assert.deepEqual(report.tracked_vault_files, ['edw-doc/index.md']);
  assert.equal(report.effective_rules[0].ignored, true);
  assert.equal(report.git_verified, false);
  assert.throws(() => assertIgnoredOutputs(root, 'edw-doc'), /vault contains tracked files/);
  assert.deepEqual(await hashes(root), before);
  assert.equal(git(root, 'ls-files', '--', 'edw-doc/').trim(), 'edw-doc/index.md');
});

test('tracked Claude files remain visible warnings without preventing safe vault generation', { skip:!gitAvailable }, async t => {
  const root = await gitFixture(t);
  fs.mkdirSync(path.join(root, '.claude'));
  fs.writeFileSync(path.join(root, '.claude', 'settings.json'), '{}\n');
  git(root, 'add', '--', '.claude/settings.json');
  ensureIgnore(root, 'edw-doc');
  const report = assertIgnoredOutputs(root, 'edw-doc');
  assert.deepEqual(report.tracked_claude_files, ['.claude/settings.json']);
  assert.match(report.warnings.join(' '), /already tracked/);
});

test('a non-Git folder can be used without claiming that Git verified its rules', async t => {
  const root = await temporaryDirectory(t, 'edw-doc-ignore-nongit-');
  ensureIgnore(root, 'edw-doc');
  const report = assertIgnoredOutputs(root, 'edw-doc');
  assert.equal(report.git_available, false);
  assert.equal(report.git_verified, false);
  assert.equal(report.git_root, null);
  assert.deepEqual(report.effective_rules.map(item => item.ignored), [null, null]);
  assert.match(report.warnings.join(' '), /verification is unavailable/);
});

test('a UTF-16 ignore file is rejected without appending mixed-encoding rules', async t => {
  const root = await temporaryDirectory(t, 'edw-doc-ignore-encoding-');
  const original = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('/edw-doc/\r\n/.claude/\r\n', 'utf16le')]);
  fs.writeFileSync(path.join(root, '.gitignore'), original);
  assert.throws(() => ensureIgnore(root, 'edw-doc'), /must use UTF-8/);
  assert.throws(() => assertIgnoredOutputs(root, 'edw-doc'), /must use UTF-8/);
  assert.deepEqual(fs.readFileSync(path.join(root, '.gitignore')), original);
});

test('UTF-8 BOM rules are recognized without duplication and are verified by Git', { skip:!gitAvailable }, async t => {
  const root = await gitFixture(t);
  const original = Buffer.from('\ufeff/edw-doc/\r\n/.claude/\r\n');
  fs.writeFileSync(path.join(root, '.gitignore'), original);
  assert.equal(ensureIgnore(root, 'edw-doc'), false);
  assert.equal(assertIgnoredOutputs(root, 'edw-doc').git_verified, true);
  assert.deepEqual(fs.readFileSync(path.join(root, '.gitignore')), original);
});
