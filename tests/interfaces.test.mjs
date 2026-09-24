import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fixture, hashes, temporaryDirectory } from './helpers.mjs';
import { createEngine } from '../src/engine.mjs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { mcpClient } from './mcp-client.mjs';
import { invalidateRuns } from '../src/run-authorization.mjs';

const cli = fileURLToPath(new URL('../scripts/cli.mjs', import.meta.url));
const sessionStart = fileURLToPath(new URL('../scripts/session-start.mjs', import.meta.url));

function run(script, args, { cwd, input, env = {} }) {
  const inherited = { ...process.env };
  for (const key of ['EDW_DOC_ROOT', 'EDW_DOC_NAME', 'DOC_VAULT_ROOT', 'DOC_VAULT_NAME']) delete inherited[key];
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd, input, env: { ...inherited, ...env },
    encoding: 'utf8', timeout: 15000, maxBuffer: 2 * 1024 * 1024, windowsHide: true,
  });
  if (result.error) throw result.error;
  return result;
}

test('CLI scan/read/status operate on the explicit repository and emit machine-readable results', async (t) => {
  const root = await fixture(t, 'security');
  const unrelated = await temporaryDirectory(t, 'edw-doc-cli-cwd-');
  const before = await hashes(root);
  const initial = run(cli, ['status', '--root', root], { cwd: unrelated });
  assert.equal(initial.status, 0, initial.stderr);
  assert.equal(JSON.parse(initial.stdout).initialized, false);
  assert.deepEqual(await hashes(root), before, 'Status before initialization does not create files');
  const scanned = run(cli, ['scan', '--root', root], { cwd: unrelated });
  assert.equal(scanned.status, 0, scanned.stderr);
  assert.ok(JSON.parse(scanned.stdout).snapshot);
  const current = run(cli, ['status', '--root', root], { cwd: unrelated });
  assert.equal(current.status, 0, current.stderr);
  assert.equal(JSON.parse(current.stdout).fresh, true);
  const read = run(cli, ['read', '--root', root, '--path', 'src/safe.js'], { cwd: unrelated });
  assert.equal(read.status, 0, read.stderr);
  assert.match(JSON.parse(read.stdout).text, /greeting/);
  const lint = run(cli, ['lint', '--root', root], { cwd: unrelated });
  assert.equal(lint.status, 0, lint.stderr);
  assert.equal(JSON.parse(lint.stdout).ok, true);
  assert.deepEqual(await hashes(unrelated), {});
  assert.deepEqual(await hashes(root, { exclude: ['.gitignore', 'edw-doc'] }), before);
});

test('CLI rejects unknown options without initializing the target', async (t) => {
  const root = await fixture(t, 'security');
  const before = await hashes(root);
  const result = run(cli, ['scan', '--root', root, '--unsafe-shell', 'anything'], { cwd: root });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown|option/i);
  assert.deepEqual(await hashes(root), before);
});

test('MCP stdio negotiates, exposes bounded tools, and keeps its repository binding fixed', async (t) => {
  const root = await fixture(t, 'security');
  const unrelated = await temporaryDirectory(t, 'edw-doc-mcp-cwd-');
  const before = await hashes(root), session_id = crypto.randomUUID();
  invalidateRuns(root, { hook_event_name: 'UserPromptSubmit', session_id });
  const client = await mcpClient(t, root, { cwd: path.dirname(unrelated) });
  assert.equal(client.initialized.result.protocolVersion, '2025-06-18');
  const tools = (await client.request('tools/list')).result.tools;
  assert.ok(tools.some(tool => tool.name === 'vault_publish'));
  assert.ok(tools.every(tool => tool.inputSchema.additionalProperties === false));
  const begin = await client.call('vault_begin', { command: 'build', session_id });
  assert.equal(begin.isError, false, begin.content[0].text);
  const { run_id } = begin.structuredContent;
  assert.equal((await client.call('vault_status', { run_id })).structuredContent.initialized, false);
  assert.equal((await client.call('vault_scan', { run_id })).isError, false);
  assert.match((await client.call('vault_read', { run_id, path: 'src/safe.js', start_line: 1, end_line: 4 })).structuredContent.text, /greeting/);
  assert.equal((await client.call('vault_scan', { run_id, root: unrelated })).isError, true);
  assert.equal((await client.call('vault_read', { run_id, path: '../outside.js' })).isError, true);
  assert.deepEqual((await client.request('ping')).result, {});
  assert.equal((await client.request('unsupported/method')).error.code, -32601);
  const standards = await client.call('vault_standards', { run_id, path: 'src/safe.js' });
  assert.equal(standards.isError, false);
  assert.ok(standards.structuredContent.rules.every(rule => rule.assessment.result === 'not-assessed'));
  assert.equal((await client.call('vault_assess', { run_id, path: 'src/safe.js', expected_source_sha256: '0'.repeat(64), assessments: [] })).isError, true);
  await client.call('vault_end', { run_id });
  assert.deepEqual(await hashes(unrelated), {});
  assert.deepEqual(await hashes(root, { exclude: ['.gitignore', 'edw-doc'] }), before);
});

test('SessionStart is quiet without a vault and checks existing freshness without writes', async (t) => {
  const root = await fixture(t, 'security');
  const options = { cwd: root, input: JSON.stringify({ cwd: root }), env: { EDW_DOC_ROOT: root, EDW_DOC_NAME: 'edw-doc' } };
  const original = await hashes(root);
  const absent = run(sessionStart, [], options);
  assert.equal(absent.status, 0, absent.stderr);
  assert.equal(absent.stdout, '');
  assert.deepEqual(await hashes(root), original);
  await (await createEngine(root)).scan();
  const initialized = await hashes(root);
  const present = run(sessionStart, [], options);
  assert.equal(present.status, 0, present.stderr);
  const context = JSON.parse(present.stdout).hookSpecificOutput;
  assert.equal(context.hookEventName, 'SessionStart');
  assert.match(context.additionalContext, /current/i);
  assert.deepEqual(await hashes(root), initialized);
  await writeFile(path.join(root, 'src', 'safe.js'), '\n// An uncommitted change\n', { flag: 'a' });
  const edited = await hashes(root);
  const stale = run(sessionStart, [], options);
  assert.equal(stale.status, 0, stale.stderr);
  assert.match(JSON.parse(stale.stdout).hookSpecificOutput.additionalContext, /changed|sync/i);
  assert.deepEqual(await hashes(root), edited);
});
