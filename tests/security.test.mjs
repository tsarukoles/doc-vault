import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile, mkdir, symlink, rename, link } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createEngine } from '../src/engine.mjs';
import { fixture, hashes, temporaryDirectory, allRecords } from './helpers.mjs';

test('source operations reject parent traversal and absolute paths', async (t) => {
  const root = await fixture(t, 'security');
  const outside = await temporaryDirectory(t, 'edw-doc-outside-');
  const privateFile = path.join(outside, 'outside.txt');
  await writeFile(privateFile, 'outside source scope');
  const engine = await createEngine(root);
  await engine.scan();
  for (const requested of ['../outside.txt', '..\\outside.txt', privateFile]) {
    await assert.rejects(engine.read({ path: requested }), `read must reject ${requested}`);
    await assert.rejects(engine.packet({ path: requested }), `packet must reject ${requested}`);
    await assert.rejects(engine.note({ path: requested }), `note must reject ${requested}`);
  }
  await assert.rejects(createEngine(root, { vaultName: '../escape' }));
  await assert.rejects(createEngine(root, { vaultName: outside }));
  assert.equal(await readFile(privateFile, 'utf8'), 'outside source scope');
});

test('the generator rejects a vault path redirected outside the repository', async (t) => {
  const root = await fixture(t, 'security');
  const outside = await temporaryDirectory(t, 'edw-doc-link-target-');
  await writeFile(path.join(outside, 'marker.txt'), 'unchanged');
  try {
    await symlink(outside, path.join(root, 'edw-doc'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip('The test host does not permit directory links.');
    throw error;
  }
  const before = await hashes(outside);
  await assert.rejects(async () => {
    const engine = await createEngine(root);
    await engine.scan();
  });
  assert.deepEqual(await hashes(outside), before);
});

test('the narrow ignore-file exception cannot modify a hard-linked file elsewhere', async (t) => {
  const root = await fixture(t, 'security');
  const outside = await temporaryDirectory(t, 'edw-doc-ignore-target-');
  const target = path.join(outside, 'original.txt');
  await writeFile(target, '# Original text\n');
  try {
    await link(target, path.join(root, '.gitignore'));
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP', 'EXDEV'].includes(error.code)) return t.skip('The test host does not permit a same-filesystem hard link.');
    throw error;
  }
  await assert.rejects(async () => {
    const engine = await createEngine(root);
    await engine.scan();
  }, /link|ordinary/i);
  assert.equal(await readFile(target, 'utf8'), '# Original text\n');
});

test('source links cannot escape the repository read boundary', async (t) => {
  const root = await fixture(t, 'security');
  const outside = await temporaryDirectory(t, 'edw-doc-source-target-');
  await writeFile(path.join(outside, 'outside.js'), 'export const secret = "outside";');
  try {
    await symlink(outside, path.join(root, 'linked-source'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip('The test host does not permit directory links.');
    throw error;
  }
  const engine = await createEngine(root);
  await engine.scan();
  await assert.rejects(engine.read({ path: 'linked-source/outside.js' }));
  const result = await engine.list({ limit: 500 });
  assert.ok(!result.items.some((item) => item.path === 'linked-source/outside.js'));
});

test('tracked vault content blocks initialization rather than merely emitting a warning', async (t) => {
  if (spawnSync('git', ['--version'], { stdio: 'ignore' }).status !== 0) return t.skip('Git is not available.');
  const root = await fixture(t, 'security');
  await mkdir(path.join(root, 'edw-doc'));
  await writeFile(path.join(root, 'edw-doc', 'tracked.md'), '# Already tracked\n');
  execFileSync('git', ['init', '--quiet', root], { stdio: 'pipe' });
  execFileSync('git', ['-C', root, 'add', '--', 'edw-doc/tracked.md'], { stdio: 'pipe' });
  const before = await hashes(root);
  await assert.rejects(async () => {
    const engine = await createEngine(root);
    await engine.scan();
  }, /track|index|vault/i);
  assert.deepEqual(await hashes(root), before, 'Rejected initialization must not change sources, Git metadata, or the tracked vault');
});

test('refresh cannot write through an output subtree redirected after initialization', async (t) => {
  const root = await fixture(t, 'security');
  const outside = await temporaryDirectory(t, 'edw-doc-output-target-');
  const engine = await createEngine(root);
  await engine.scan();
  await writeFile(path.join(outside, 'marker.md'), '# Keep\n');
  const outputDirectory = path.resolve(root, 'edw-doc', 'flows');
  const savedDirectory = path.resolve(root, 'edw-doc', 'flows.original');
  assert.ok(outputDirectory.startsWith(path.resolve(root) + path.sep));
  assert.ok(savedDirectory.startsWith(path.resolve(root) + path.sep));
  try {
    await rename(outputDirectory, savedDirectory);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  try {
    await symlink(outside, outputDirectory, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip('The test host does not permit directory links.');
    throw error;
  }
  const before = await hashes(outside);
  const source = await engine.read({ path: 'src/safe.js', start_line: 1, end_line: 4 });
  await assert.rejects(engine.publish({
    kind: 'flow', title: 'Example flow', slug: 'escape', summary: 'An example source relationship.',
    source_paths: ['src/safe.js'],
    sections: [{ heading: 'Evidence', text: 'The source exports greeting.', evidence: [{ path: source.path, start_line: 1, end_line: 4, sha256: source.sha256 }] }],
    review_status: 'draft',
  }));
  assert.deepEqual(await hashes(outside), before);
});

test('linked Git worktrees keep Git metadata out of source notes and leave it unchanged', async (t) => {
  if (spawnSync('git', ['--version'], { stdio: 'ignore' }).status !== 0) return t.skip('Git is not available.');
  const main = await fixture(t, 'security');
  const worktree = await temporaryDirectory(t, 'edw-doc-worktree-');
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));
  const git = (...args) => execFileSync('git', [
    '-c', `core.hooksPath=${path.join(main, 'no-hooks')}`,
    '-c', 'core.fsmonitor=false', '-c', 'commit.gpgsign=false',
    '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
    '-C', main, ...args,
  ], { stdio: 'pipe', env, windowsHide: true });
  git('init', '--quiet', '--template=');
  git('add', '--', 'README.md', 'src/safe.js');
  git('commit', '--quiet', '-m', 'Synthetic fixture');
  git('worktree', 'add', '--quiet', '--detach', worktree, 'HEAD');
  const before = await hashes(path.join(main, '.git'));
  const engine = await createEngine(worktree);
  await engine.scan();
  const metadata = (await allRecords(engine)).find((item) => item.path === '.git');
  assert.ok(!metadata || !metadata.note_path, 'A worktree .git pointer is metadata, not a source file');
  assert.deepEqual(await hashes(path.join(main, '.git')), before);
  assert.equal((await engine.lint()).ok, true);
});

test('failing Git metadata checks refuse initialization before any allowed output writes', async (t) => {
  const root = await fixture(t, 'security');
  await mkdir(path.join(root, '.git'));
  const original = await hashes(root);
  await assert.rejects(async () => {
    const engine = await createEngine(root);
    await engine.scan();
  }, /git|metadata|repository|track/i);
  assert.deepEqual(await hashes(root), original, 'A failed Git safety check cannot append ignores or initialize the vault');
});
