import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fixture, hashes, temporaryDirectory } from './helpers.mjs';
import { createEngine } from '../src/engine.mjs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const cli = fileURLToPath(new URL('../scripts/cli.mjs', import.meta.url));
const mcp = fileURLToPath(new URL('../scripts/mcp.mjs', import.meta.url));
const sessionStart = fileURLToPath(new URL('../scripts/session-start.mjs', import.meta.url));

function run(script, args, { cwd, input, env = {} }) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd, input, env: { ...process.env, ...env },
    encoding: 'utf8', timeout: 15000, maxBuffer: 2 * 1024 * 1024, windowsHide: true,
  });
  if (result.error) throw result.error;
  return result;
}

test('CLI scan/read/status operate on the explicit repository and emit machine-readable results', async (t) => {
  const root = await fixture(t, 'security');
  const unrelated = await temporaryDirectory(t, 'doc-vault-cli-cwd-');
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
  assert.deepEqual(await hashes(root, { exclude: ['.gitignore', 'doc-vault'] }), before);
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
  const unrelated = await temporaryDirectory(t, 'doc-vault-mcp-cwd-');
  const before = await hashes(root);
  const request = (id, method, params) => ({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });
  const messages = [
    request(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'fixture-client', version: '1.0.0' } }),
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    request(2, 'tools/list'),
    request(3, 'tools/call', { name: 'vault_status', arguments: {} }),
    request(4, 'tools/call', { name: 'vault_scan', arguments: {} }),
    request(5, 'tools/call', { name: 'vault_read', arguments: { path: 'src/safe.js', start_line: 1, end_line: 4 } }),
    request(6, 'tools/call', { name: 'vault_scan', arguments: { root: unrelated } }),
    request(7, 'tools/call', { name: 'vault_read', arguments: { path: '../outside.js' } }),
    request(8, 'ping'),
    request(9, 'unsupported/method'),
  ];
  const result = run(mcp, [], {
    cwd: unrelated,
    input: messages.map((message) => JSON.stringify(message)).join('\n') + '\n',
    env: { DOC_VAULT_ROOT: root, DOC_VAULT_NAME: 'doc-vault', CLAUDE_PROJECT_DIR: unrelated },
  });
  assert.equal(result.status, 0, result.stderr);
  const responses = result.stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.equal(responses.length, 9, 'Notifications must not receive responses and stdout must contain only JSON-RPC');
  const byId = new Map(responses.map((response) => [response.id, response]));
  assert.equal(byId.get(1).result.protocolVersion, '2025-06-18');
  assert.ok(byId.get(2).result.tools.some((tool) => tool.name === 'vault_publish'));
  assert.ok(byId.get(2).result.tools.every((tool) => tool.inputSchema.additionalProperties === false));
  assert.equal(byId.get(3).result.structuredContent.initialized, false);
  assert.equal(byId.get(4).result.isError, false);
  assert.match(byId.get(5).result.structuredContent.text, /greeting/);
  assert.equal(byId.get(6).result.isError, true, 'The model cannot redirect the bound root through tool arguments');
  assert.equal(byId.get(7).result.isError, true);
  assert.deepEqual(byId.get(8).result, {});
  assert.equal(byId.get(9).error.code, -32601);
  assert.deepEqual(await hashes(unrelated), {});
  assert.deepEqual(await hashes(root, { exclude: ['.gitignore', 'doc-vault'] }), before);
});

test('SessionStart is quiet without a vault and checks existing freshness without writes', async (t) => {
  const root = await fixture(t, 'security');
  const options = { cwd: root, input: JSON.stringify({ cwd: root }), env: { DOC_VAULT_ROOT: root, DOC_VAULT_NAME: 'doc-vault' } };
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
