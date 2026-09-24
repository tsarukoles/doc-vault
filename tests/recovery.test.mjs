import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createEngine } from '../src/engine.mjs';
import { fixture, sourceNote } from './helpers.mjs';

test('an interrupted publication reports stale status and recovers its managed outputs', async (t) => {
  const root = await fixture(t, 'security');
  const engine = await createEngine(root);
  await engine.scan();
  const before = await sourceNote(engine, 'src/safe.js');
  await writeFile(path.join(root, 'src', 'safe.js'), '\n// New source revision awaiting publication\n', { flag: 'a' });
  const failDestination = path.join(root, 'edw-doc', before.path);
  // Fault injection stays in a disposable child process. Abrupt termination
  // during a real note write exercises the actual journal and dead-writer lock.
  const crash = `
    import fs from 'node:fs';
    import path from 'node:path';
    const { createEngine } = await import(process.argv[1]);
    const originalRename = fs.renameSync;
    fs.renameSync = function(from, to) {
      if (path.resolve(to) === path.resolve(process.argv[3])) process.exit(71);
      return originalRename.call(this, from, to);
    };
    await (await createEngine(process.argv[2])).refresh();
    process.exit(72);
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', crash,
    new URL('../src/engine.mjs', import.meta.url).href, root, failDestination],
  { cwd: root, encoding: 'utf8', timeout: 15000, windowsHide: true });
  if (child.error) throw child.error;
  assert.equal(child.status, 71, child.stderr || 'The intentional publication fault was not reached');
  const interrupted = await engine.status();
  assert.equal(interrupted.fresh, false);
  assert.equal(interrupted.pending_update, true);
  await engine.refresh();
  const recovered = await engine.status();
  assert.equal(recovered.fresh, true);
  assert.equal(recovered.pending_update, false);
  assert.notEqual((await sourceNote(engine, 'src/safe.js')).sha256, before.sha256);
  const lint = await engine.lint();
  assert.equal(lint.ok, true, JSON.stringify(lint));
});
