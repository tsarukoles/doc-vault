import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fixture, hashes } from './helpers.mjs';
import { createEngine } from '../src/engine.mjs';
import { installIntegration, removeIntegration } from '../src/integration.mjs';
import { maintain } from '../src/maintenance.mjs';
import crypto from 'node:crypto';
import { mcpClient } from './mcp-client.mjs';
import { invalidateRuns } from '../src/run-authorization.mjs';

const cli = fileURLToPath(new URL('../scripts/cli.mjs', import.meta.url));
const hook = fileURLToPath(new URL('../scripts/maintenance-hook.mjs', import.meta.url));
const start = fileURLToPath(new URL('../scripts/session-start.mjs', import.meta.url));
async function configured(t, vaultName = 'edw-doc') {
  const root = await fixture(t, 'security');
  execFileSync('git', ['init', '-q', root], { windowsHide: true });
  installIntegration(root, { vaultName });
  const engine = await createEngine(root, { vaultName });
  await engine.scan();
  return { root, engine, vault: path.join(root, vaultName) };
}
function run(script, root, args = [], event = {}) {
  const env = { ...process.env, DOC_VAULT_ROOT: root };
  delete env.DOC_VAULT_NAME;
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, env, input: JSON.stringify(event), encoding: 'utf8', timeout: 15000, windowsHide: true });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return result;
}

test('without setup, or before the first build, hooks never create or modify a vault', async t => {
  const root = await fixture(t, 'security');
  const before = await hashes(root);
  assert.equal((await maintain(root, { hook_event_name: 'Stop' })).skipped, true);
  assert.deepEqual(await hashes(root), before);
  execFileSync('git', ['init', '-q', root], { windowsHide: true });
  installIntegration(root);
  const setup = await hashes(root);
  assert.equal((await maintain(root, { hook_event_name: 'SessionStart' })).skipped, true);
  assert.deepEqual(await hashes(root), setup);
  assert.equal(fs.existsSync(path.join(root, 'edw-doc')), false);
});

test('session reconciliation detects external add/edit/delete/rename and preserves source bytes', async t => {
  const { root, engine, vault } = await configured(t);
  fs.appendFileSync(path.join(root, 'src/safe.js'), '\nexport const updated = true;\n');
  fs.mkdirSync(path.join(root, 'new-directory'));
  fs.writeFileSync(path.join(root, 'new-directory/new.js'), 'export const created = true;\n');
  fs.mkdirSync(path.join(vault, 'annotations'), { recursive: true });
  fs.writeFileSync(path.join(vault, 'annotations/owner.md'), 'Preserve my notes.\n');
  const before = await hashes(root, { exclude: ['edw-doc'] });
  const result = await maintain(root, { hook_event_name: 'UserPromptSubmit' });
  assert.equal(result.refreshed, true);
  assert.equal(result.pending, true);
  assert.equal((await engine.status()).fresh, true);
  assert.ok((await engine.list()).items.some(item => item.path === 'new-directory/new.js'));
  assert.deepEqual(await hashes(root, { exclude: ['edw-doc'] }), before);
  fs.renameSync(path.join(root, 'new-directory/new.js'), path.join(root, 'new-directory/moved.js'));
  fs.unlinkSync(path.join(root, 'src/safe.js'));
  await maintain(root, { hook_event_name: 'Stop', stop_hook_active: true });
  const records = (await engine.list()).items;
  assert.ok(records.some(item => item.path === 'new-directory/moved.js'));
  assert.ok(!records.some(item => item.path === 'src/safe.js'));
  assert.equal(fs.readFileSync(path.join(vault, 'annotations/owner.md'), 'utf8'), 'Preserve my notes.\n');
});

test('one Stop reminder per snapshot, including new files already refreshed by another watcher', async t => {
  const { root, engine } = await configured(t);
  const event = { hook_event_name: 'Stop', stop_hook_active: false };
  assert.equal((await maintain(root, event)).notifySync, true);
  assert.equal((await maintain(root, event)).notifySync, false);
  const nextPrompt = await maintain(root, { hook_event_name: 'UserPromptSubmit' });
  assert.equal(nextPrompt.pending, true);
  assert.equal(nextPrompt.notifySync, false);
  fs.writeFileSync(path.join(root, 'src/added.js'), 'export const addition = true;\n');
  await engine.refresh();
  const second = await maintain(root, event);
  assert.equal(second.refreshed, false);
  assert.equal(second.notifySync, true);
  assert.equal((await maintain(root, { ...event, stop_hook_active: true })).notifySync, false);
  assert.equal((await maintain(root, event)).notifySync, false);
});

test('an existing custom main agent still receives maintenance', async t => {
  const { root, engine } = await configured(t);
  fs.appendFileSync(path.join(root, 'src/safe.js'), '\n// custom main-agent edit\n');
  const result = await maintain(root, { hook_event_name: 'Stop', agent_type: 'custom-coding-agent' });
  assert.equal(result.refreshed, true);
  assert.equal(result.notifySync, true);
  assert.equal((await engine.status()).fresh, true);
});

test('completed file analysis clears the computed backlog instead of retrying on a receipt', async t => {
  const { root, engine } = await configured(t);
  assert.equal((await maintain(root, { hook_event_name: 'Stop' })).notifySync, true);
  for (const record of (await engine.list({ kind: 'included' })).items) {
    const source = await engine.read({ path: record.path, start_line: 1, end_line: 1 });
    await engine.publish({ kind: 'file', title: record.path, slug: record.path,
      summary: 'Synthetic explanation used only to exercise completion tracking.', source_paths: [record.path],
      sections: [{ heading: 'Fixture evidence', text: 'This fixture publication records that the first line was inspected.',
        evidence: [{ path: record.path, sha256: source.sha256, start_line: 1, end_line: 1 }] }] });
  }
  const completed = await maintain(root, { hook_event_name: 'Stop', stop_hook_active: true });
  assert.equal(completed.pending, false);
  assert.equal(completed.notifySync, false);
  assert.equal(completed.pendingFiles, 0);
});

test('plan mode, plugin subagents, broker tools, and disabled maintenance never mutate', async t => {
  const { root } = await configured(t);
  fs.appendFileSync(path.join(root, 'src/safe.js'), '\n// pending change\n');
  const before = await hashes(root);
  for (const event of [
    { hook_event_name: 'Stop', permission_mode: 'plan' },
    { hook_event_name: 'PostToolUse', agent_id: 'worker', tool_name: 'Read' },
    { hook_event_name: 'PostToolUse', tool_name: 'mcp__plugin_doc-vault_vault__vault_publish' },
    { hook_event_name: 'SubagentStop' },
  ]) assert.equal((await maintain(root, event)).skipped, true);
  assert.deepEqual(await hashes(root), before);
  const configPath = path.join(root, '.claude/doc-vault/config.json');
  const config = JSON.parse(fs.readFileSync(configPath));
  config.maintenance.enabled = false;
  fs.writeFileSync(configPath, JSON.stringify(config));
  const disabled = await hashes(root);
  assert.equal((await maintain(root, { hook_event_name: 'Stop' })).skipped, true);
  assert.deepEqual(await hashes(root), disabled);
});

test('overlapping checkpoints publish one reminder and leave no live controller lock', async t => {
  const { root, vault } = await configured(t);
  const results = await Promise.all([
    maintain(root, { hook_event_name: 'Stop' }),
    maintain(root, { hook_event_name: 'Stop' }),
  ]);
  assert.equal(results.filter(result => result.notifySync).length, 1);
  assert.equal(results.filter(result => result.busy).length, 1);
  assert.equal(fs.existsSync(path.join(vault, '.system/maintenance-lock.json')), false);
});

test('hook protocol is nonblocking on failure and never overwrites manually edited notes', async t => {
  const { root, vault } = await configured(t);
  const note = path.join(vault, 'files/src/safe.js.md');
  fs.appendFileSync(note, '\nPersonal addition.\n');
  fs.appendFileSync(path.join(root, 'src/safe.js'), '\n// source changed\n');
  const original = fs.readFileSync(note, 'utf8');
  const failed = run(hook, root, [], { cwd: root, hook_event_name: 'Stop' });
  assert.equal(failed.stdout, '');
  assert.match(failed.stderr, /deferred|manual/i);
  assert.equal(fs.readFileSync(note, 'utf8'), original);
});

test('CLI setup/status/uninstall and custom vault configuration work without host settings edits', async t => {
  const root = await fixture(t, 'security');
  execFileSync('git', ['init', '-q', root], { windowsHide: true });
  const setup = JSON.parse(run(cli, root, ['setup', '--root', root, '--vault-name', 'custom-doc']).stdout);
  assert.equal(setup.vaultName, 'custom-doc');
  assert.equal(JSON.parse(run(cli, root, ['setup-status', '--root', root]).stdout).installed, true);
  assert.equal(JSON.parse(run(cli, root, ['scan', '--root', root]).stdout).vault, 'custom-doc');
  assert.equal(fs.existsSync(path.join(root, 'edw-doc')), false);
  const begun = JSON.parse(run(start, root, [], { cwd: root, hook_event_name: 'SessionStart' }).stdout);
  assert.equal(begun.hookSpecificOutput.hookEventName, 'SessionStart');
  const stopped = JSON.parse(run(hook, root, [], { cwd: root, hook_event_name: 'Stop' }).stdout);
  assert.equal(stopped.decision, undefined);
  assert.match(stopped.systemMessage, /sync/);
  assert.equal(run(hook, root, [], { cwd: root, hook_event_name: 'Stop', stop_hook_active: true }).stdout, '');
  assert.equal(JSON.parse(run(cli, root, ['uninstall', '--root', root]).stdout).installed, false);
  const before = await hashes(root);
  assert.equal(run(hook, root, [], { cwd: root, hook_event_name: 'Stop' }).stdout, '');
  assert.deepEqual(await hashes(root), before);
});

test('MCP follows setup vault selection without exposing integration write operations', async t => {
  const { root } = await configured(t, 'custom-doc');
  const session_id = crypto.randomUUID();
  invalidateRuns(root, { hook_event_name: 'UserPromptSubmit', session_id });
  const client = await mcpClient(t, root, { vaultName: '' });
  const tools = (await client.request('tools/list')).result.tools;
  assert.ok(tools.every(tool => !/setup|uninstall|integration/.test(tool.name)));
  const begin = await client.call('vault_begin', { command: 'status', session_id });
  const status = await client.call('vault_status', { run_id: begin.structuredContent.run_id });
  assert.equal(status.structuredContent.vault, 'custom-doc');
});

test('uninstall preserves edited config but disables maintenance', async t => {
  const { root } = await configured(t);
  fs.appendFileSync(path.join(root, '.claude/doc-vault/config.json'), '\n');
  removeIntegration(root);
  const before = await hashes(root);
  assert.equal((await maintain(root, { hook_event_name: 'Stop' })).skipped, true);
  assert.deepEqual(await hashes(root), before);
});
