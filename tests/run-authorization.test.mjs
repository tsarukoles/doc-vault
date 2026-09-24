import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fixture, hashes } from './helpers.mjs';
import { mcpClient } from './mcp-client.mjs';
import { COMMAND_TOOLS, createRunAuthorization, invalidateRuns, supportsRunApproval } from '../src/run-authorization.mjs';

const host = { name: 'claude-code', version: '2.1.199' };
const session = () => crypto.randomUUID();
const start = (root, sessionId) => invalidateRuns(root, { hook_event_name: 'UserPromptSubmit', session_id: sessionId });

test('each command grants only its operations, keeps one approval across batches, and revokes on end', async t => {
  const root = await fixture(t, 'security');
  const before = await hashes(root);
  const auth = createRunAuthorization(root), sessionId = session();
  start(root, sessionId);
  for (const [command, allowed] of Object.entries(COMMAND_TOOLS)) {
    const { run_id } = auth.begin({ command, session_id: sessionId }, host);
    for (let batch = 0; batch < 4; batch++) for (const tool of allowed) auth.check(run_id, tool);
    for (const tool of new Set(Object.values(COMMAND_TOOLS).flat())) if (!allowed.includes(tool)) assert.throws(() => auth.check(run_id, tool), /outside/);
    assert.throws(() => auth.check(run_id, 'Bash'), /outside/);
    auth.end(run_id);
    assert.throws(() => auth.check(run_id, allowed[0]), /No active/);
  }
  assert.deepEqual(await hashes(root), before, 'Approval bookkeeping never initializes or writes a repository vault');
});

test('host lifecycle revokes only the affected session and compaction preserves a live approval', async t => {
  const root = await fixture(t, 'security');
  const a = session(), b = session(), auth = createRunAuthorization(root);
  start(root, a); start(root, b);
  const first = auth.begin({ command: 'build', session_id: a }, host).run_id;
  const other = auth.begin({ command: 'standards', session_id: b }, host).run_id;
  invalidateRuns(root, { hook_event_name: 'SessionStart', source: 'compact', session_id: a });
  invalidateRuns(root, { hook_event_name: 'SubagentStop', agent_type: 'Explore', session_id: a });
  invalidateRuns(root, { hook_event_name: 'SubagentStop', agent_type: 'edw-doc:worker', session_id: a });
  auth.check(first, 'vault_publish');
  for (const event of ['UserPromptSubmit', 'Stop', 'SessionEnd', 'SubagentStop']) {
    start(root, a);
    const id = auth.begin({ command: 'build', session_id: a }, host).run_id;
    invalidateRuns(root, { hook_event_name: event, session_id: a, agent_type: 'edw-doc:curator' });
    assert.throws(() => auth.check(id, 'vault_scan'), /ended|expired/);
    auth.check(other, 'vault_assess');
  }
});

test('new approval replaces old scope, cancellation revokes it, and unknown clients fail closed', async t => {
  const root = await fixture(t, 'security');
  const sessionId = session(), auth = createRunAuthorization(root);
  assert.throws(() => auth.begin({ command: 'build', session_id: sessionId }, host), /hooks are not active/);
  start(root, sessionId);
  for (const client of [undefined, { name: 'claude-code', version: '2.1.198' }, { name: 'claude-ai', version: '0.1.0' }]) {
    assert.equal(supportsRunApproval(client), false);
    assert.throws(() => auth.begin({ command: 'build', session_id: sessionId }, client), /2.1.199/);
  }
  const first = auth.begin({ command: 'build', session_id: sessionId }, host).run_id;
  const next = auth.begin({ command: 'status', session_id: sessionId }, host).run_id;
  assert.throws(() => auth.check(first, 'vault_scan'), /No active/);
  assert.throws(() => auth.check(next, 'vault_scan'), /outside/);
  auth.cancel();
  assert.throws(() => auth.check(next, 'vault_status'), /No active/);
  assert.throws(() => auth.begin({ command: '__proto__', session_id: sessionId }, host), /Unknown/);
});

test('idle grants expire without imposing a batch or token limit on active runs', async t => {
  const root = await fixture(t, 'security'), sessionId = session();
  start(root, sessionId);
  let now = 0;
  const auth = createRunAuthorization(root, { now: () => now });
  const { run_id } = auth.begin({ command: 'build', session_id: sessionId }, host);
  for (let hour = 0; hour < 30; hour++) { now += 3600000; auth.check(run_id, 'vault_read'); }
  now += 4 * 3600000;
  assert.throws(() => auth.check(run_id, 'vault_read'), /expired/);
});

test('MCP exposes one interactive approval tool and enforces its grant before actual reads/writes', async t => {
  const root = await fixture(t, 'security'), sessionId = session();
  const before = await hashes(root);
  start(root, sessionId);
  const client = await mcpClient(t, root);
  const tools = (await client.request('tools/list')).result.tools;
  assert.deepEqual(tools.filter(tool => tool._meta?.['anthropic/requiresUserInteraction']).map(tool => tool.name), ['vault_begin']);
  assert.equal(tools.find(tool => tool.name === 'vault_lint').annotations.readOnlyHint, true);
  assert.ok(tools.find(tool => tool.name === 'vault_begin').description.includes(root));
  assert.equal((await client.call('vault_scan')).isError, true);
  assert.deepEqual(await hashes(root), before);
  // This simulates the host dispatch AFTER its human approval. It does not test the CLI dialog.
  const begin = await client.call('vault_begin', { command: 'build', session_id: sessionId });
  assert.equal(begin.isError, false, begin.content[0].text);
  const { run_id } = begin.structuredContent;
  const scan = await client.call('vault_scan', { run_id });
  assert.equal(scan.isError, false, scan.content[0].text);
  for (let batch = 0; batch < 3; batch++) {
    const read = await client.call('vault_read', { run_id, path: 'src/safe.js' });
    assert.equal(read.isError, false, read.content[0].text);
  }
  const escape = await client.call('vault_read', { run_id, path: '../outside.js' });
  assert.equal(escape.isError, true);
  assert.equal((await client.call('vault_end', { run_id })).isError, false);
  assert.equal((await client.call('vault_refresh', { run_id })).isError, true);
  assert.deepEqual(await hashes(root, { exclude: ['edw-doc', '.gitignore'] }), before);
});

test('read-only and standards approvals cannot create a vault or publish arbitrary notes', async t => {
  const root = await fixture(t, 'security'), sessionId = session();
  start(root, sessionId);
  const client = await mcpClient(t, root), before = await hashes(root);
  for (const command of ['ask', 'status', 'standards', 'review']) {
    const begin = await client.call('vault_begin', { command, session_id: sessionId });
    const run_id = begin.structuredContent.run_id;
    const denied = await client.call('vault_scan', { run_id });
    assert.equal(denied.isError, true);
    assert.match(denied.content[0].text, /outside/);
  }
  assert.deepEqual(await hashes(root), before);
});

test('host cancellation and lifecycle scripts close broker grants without blocking ordinary work', async t => {
  const root = await fixture(t, 'security'), sessionId = session();
  start(root, sessionId);
  const client = await mcpClient(t, root);
  let run_id = (await client.call('vault_begin', { command: 'build', session_id: sessionId })).structuredContent.run_id;
  client.notify('notifications/cancelled', { requestId: 42 });
  assert.equal((await client.call('vault_scan', { run_id })).isError, true);
  run_id = (await client.call('vault_begin', { command: 'build', session_id: sessionId })).structuredContent.run_id;
  const script = fileURLToPath(new URL('../scripts/run-lifecycle.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script], { cwd: root, env: { ...process.env, EDW_DOC_ROOT: root }, input: JSON.stringify({ hook_event_name: 'SubagentStop', agent_type: 'edw-doc:curator', session_id: sessionId }), encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal((await client.call('vault_scan', { run_id })).isError, true);
  const malformed = spawnSync(process.execPath, [script], { cwd: root, input: '{', encoding: 'utf8', windowsHide: true });
  assert.equal(malformed.status, 0);
  assert.equal(malformed.stdout, '');
  assert.equal(fs.existsSync(path.join(root, 'edw-doc')), false);
});
