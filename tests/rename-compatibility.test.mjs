import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createEngine } from '../src/engine.mjs';
import { configurationEnvironment, ownsMaintenance, ownsVault } from '../src/identity.mjs';
import { sha256 } from '../src/security.mjs';
import { withStandards } from '../src/standards.mjs';
import { createRunAuthorization } from '../src/run-authorization.mjs';
import { fixture, hashes, sourceNote, temporaryDirectory } from './helpers.mjs';

const cli = fileURLToPath(new URL('../scripts/cli.mjs', import.meta.url));
const sourcePath = 'src/safe.js';
const explanation = 'The greeting function returns a greeting containing the supplied name.';
const legacyStart = '<!-- doc-vault:standards:start -->';
const legacyEnd = '<!-- doc-vault:standards:end -->';
const currentStart = '<!-- edw-doc:standards:start -->';
const currentEnd = '<!-- edw-doc:standards:end -->';

function configuredEnvironment(root, vaultName, legacy = false) {
  const env = { ...process.env };
  for (const key of ['EDW_DOC_ROOT', 'EDW_DOC_NAME', 'DOC_VAULT_ROOT', 'DOC_VAULT_NAME']) delete env[key];
  env[legacy ? 'DOC_VAULT_ROOT' : 'EDW_DOC_ROOT'] = root;
  env[legacy ? 'DOC_VAULT_NAME' : 'EDW_DOC_NAME'] = vaultName;
  return env;
}

function runScript(script, env, input, cwd) {
  return spawnSync(process.execPath, [fileURLToPath(new URL(`../scripts/${script}.mjs`, import.meta.url))], { env, input, cwd, encoding: 'utf8', windowsHide: true, timeout: 15000 });
}

async function publication(engine, text = explanation) {
  const source = await engine.read({ path: sourcePath, start_line: 2, end_line: 4 });
  return {
    kind: 'file', title: 'Greeting function', summary: 'A source-backed explanation of greeting.',
    source_paths: [sourcePath],
    sections: [{ heading: 'Behavior', text, evidence: [{ path: sourcePath, sha256: source.sha256, start_line: 2, end_line: 4 }] }],
  };
}

async function legacyFixture(t, vaultName = 'edw-doc', version) {
  const root = await fixture(t, 'security');
  const engine = await createEngine(root, { vaultName });
  await engine.scan();
  await engine.publish(await publication(engine));
  const note = await sourceNote(engine, sourcePath);
  const vault = path.join(root, vaultName);
  const ownerText = '{"product":"doc-vault","schema_version":1,"fixture":"legacy owner"}\n';
  fs.writeFileSync(path.join(vault, '.system', 'owner.json'), ownerText);
  const annotation = path.join(vault, 'annotations', 'personal.md');
  fs.mkdirSync(path.dirname(annotation), { recursive: true });
  fs.writeFileSync(annotation, '# Team observation\r\nPreserve these exact bytes.\r\n');
  const stateFile = path.join(vault, '.system', 'state.json');
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  let text = note.text.replaceAll(currentStart, legacyStart).replaceAll(currentEnd, legacyEnd);
  if (version) {
    state.version = version;
    state.enrichments[note.path].producer_version = version;
    text = text.replace(/^generator_version: .*$/m, `generator_version: "${version}"`);
  }
  fs.writeFileSync(path.join(vault, note.path), text);
  state.generated[note.path] = sha256(text);
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n');
  return { root, vault, ownerText, note: { ...note, text }, state };
}

test('new vaults carry EDW Doc ownership while unrelated product markers remain invalid', async t => {
  const root = await fixture(t, 'security');
  await (await createEngine(root)).scan();
  const owner = JSON.parse(fs.readFileSync(path.join(root, 'edw-doc', '.system', 'owner.json'), 'utf8'));
  assert.equal(owner.product, 'edw-doc');
  assert.equal(ownsVault(owner), true);
  assert.equal(ownsVault({ product: 'doc-vault' }), true);
  assert.equal(ownsMaintenance({ product: 'edw-doc-maintenance' }), true);
  assert.equal(ownsMaintenance({ product: 'doc-vault-maintenance' }), true);
  for (const product of ['another-tool', 'edw-doc-maintenance', 'doc-vault-maintenance']) assert.equal(ownsVault({ product }), false);
  for (const product of ['another-tool', 'edw-doc', 'doc-vault']) assert.equal(ownsMaintenance({ product }), false);
  assert.equal(ownsVault(null), false);
  assert.equal(ownsMaintenance(undefined), false);
});

test('canonical and legacy environment settings resolve consistently and reject conflicting roots or names', () => {
  assert.deepEqual(configurationEnvironment({}), { root: undefined, vaultName: undefined });
  const expected = { root: 'C:/repositories/example', vaultName: 'team-notes' };
  assert.deepEqual(configurationEnvironment({ EDW_DOC_ROOT: expected.root, EDW_DOC_NAME: expected.vaultName }), expected);
  assert.deepEqual(configurationEnvironment({ DOC_VAULT_ROOT: expected.root, DOC_VAULT_NAME: expected.vaultName }), expected);
  assert.deepEqual(configurationEnvironment({ EDW_DOC_ROOT: expected.root, DOC_VAULT_ROOT: expected.root, EDW_DOC_NAME: expected.vaultName, DOC_VAULT_NAME: expected.vaultName }), expected);
  assert.deepEqual(configurationEnvironment({ EDW_DOC_ROOT: '', DOC_VAULT_ROOT: expected.root, EDW_DOC_NAME: '', DOC_VAULT_NAME: expected.vaultName }), expected);
  assert.throws(() => configurationEnvironment({ EDW_DOC_ROOT: 'repo-a', DOC_VAULT_ROOT: 'repo-b' }), /EDW_DOC_ROOT.*conflicts.*DOC_VAULT_ROOT/);
  assert.throws(() => configurationEnvironment({ EDW_DOC_NAME: 'team-a', DOC_VAULT_NAME: 'team-b' }), /EDW_DOC_NAME.*conflicts.*DOC_VAULT_NAME/);
});

test('legacy ownership and standards blocks survive reads and update without losing source, annotations, or compatible enrichment', async t => {
  const { root, vault, ownerText, note } = await legacyFixture(t);
  const beforeRead = await hashes(root);
  const engine = await createEngine(root);
  assert.equal((await engine.status()).fresh, true);
  assert.equal((await engine.note({ path: note.path })).text, note.text);
  assert.deepEqual(await hashes(root), beforeRead, 'Opening old output is read-only.');

  const sourceBefore = await hashes(root, { exclude: ['edw-doc'] });
  const annotationBefore = fs.readFileSync(path.join(vault, 'annotations', 'personal.md'));
  const input = await publication(engine);
  const rules = await engine.standards({ path: sourcePath, limit: 100 });
  const rule = rules.rules.find(item => item.authority === 'advisory');
  assert.ok(rule, 'The source has a bundled advisory rule.');
  await engine.assess({ path: sourcePath, expected_source_sha256: input.sections[0].evidence[0].sha256, assessments: [{ rule_id: rule.id, rule_hash: rule.hash, result: 'unknown', rationale: 'The inspected function alone does not establish this convention.', evidence: input.sections[0].evidence }] });
  const updated = await engine.note({ path: note.path });
  assert.ok(updated.text.includes(explanation));
  assert.equal(updated.text.split(currentStart).length - 1, 1);
  assert.equal(updated.text.split(currentEnd).length - 1, 1);
  assert.ok(!updated.text.includes(legacyStart));
  assert.ok(!updated.text.includes(legacyEnd));
  assert.equal(updated.text.split('## Coding standards').length - 1, 1);
  const state = JSON.parse(fs.readFileSync(path.join(vault, '.system', 'state.json'), 'utf8'));
  assert.ok(state.enrichments[note.path], 'Renaming the managed marker must preserve the source explanation.');
  await engine.refresh();
  assert.equal(fs.readFileSync(path.join(vault, '.system', 'owner.json'), 'utf8'), ownerText);
  assert.deepEqual(fs.readFileSync(path.join(vault, 'annotations', 'personal.md')), annotationBefore);
  assert.deepEqual(await hashes(root, { exclude: ['edw-doc'] }), sourceBefore);
  assert.equal((await engine.lint()).ok, true);
});

test('explicit migration accepts a pre-rename owned vault and keeps prior analysis available through version refresh', async t => {
  const { root, vault, note, state } = await legacyFixture(t, 'doc-vault', '0.1.3');
  const oldFiles = await hashes(vault);
  const sourceBefore = await hashes(root, { exclude: ['doc-vault', '.gitignore'] });
  const result = spawnSync(process.execPath, [cli, 'migrate', '--root', root, '--from', 'doc-vault', '--to', 'edw-doc'], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).migrated, true);
  const moved = path.join(root, 'edw-doc');
  assert.deepEqual(await hashes(moved), oldFiles, 'The rename itself preserves every owned byte.');
  const engine = await createEngine(root);
  assert.equal((await engine.note({ path: note.path })).text, note.text);
  await engine.refresh();
  const archive = path.join(moved, '.system', 'archive', state.snapshot.id, note.path);
  assert.equal(fs.readFileSync(archive, 'utf8'), note.text, 'A version upgrade archives old analysis before marking it stale.');
  assert.equal(fs.readFileSync(path.join(moved, 'annotations', 'personal.md'), 'utf8'), '# Team observation\r\nPreserve these exact bytes.\r\n');
  assert.deepEqual(await hashes(root, { exclude: ['edw-doc', '.gitignore'] }), sourceBefore);
  assert.equal((await engine.lint()).ok, true);
});

test('standards rendering removes both generations of owned sections and stays idempotent', () => {
  const state = { standards: { rules: {}, assessments: {} }, records: [] };
  const content = `# Explanation\n\nPreserve before.\n${legacyStart}\nObsolete legacy table.\n${legacyEnd}\nPreserve between.\n${currentStart}\nObsolete current table.\n${currentEnd}\nPreserve after.\n`;
  const rendered = withStandards(content, state, { path: sourcePath });
  for (const text of ['Preserve before.', 'Preserve between.', 'Preserve after.']) assert.ok(rendered.includes(text));
  assert.ok(!rendered.includes('Obsolete'));
  assert.ok(!rendered.includes(legacyStart));
  assert.equal(rendered.split(currentStart).length - 1, 1);
  assert.equal(rendered.split(currentEnd).length - 1, 1);
  assert.equal(withStandards(rendered, state, { path: sourcePath }), rendered);
});

test('model publications cannot inject either old or new managed standards markers', async t => {
  const root = await fixture(t, 'security');
  const engine = await createEngine(root);
  await engine.scan();
  const before = await hashes(root);
  for (const marker of [legacyStart, legacyEnd, currentStart, currentEnd]) {
    await assert.rejects(engine.publish(await publication(engine, `A source explanation.\n${marker}`)), /Managed standards markers/);
  }
  assert.deepEqual(await hashes(root), before, 'Rejected marker injection cannot alter sources or vault output.');
});

test('MCP announces EDW Doc and binds canonical or legacy environment roots and custom vault names', async t => {
  const root = await fixture(t, 'security');
  const unrelated = await temporaryDirectory(t, 'edw-doc-unrelated-');
  const before = await hashes(root);
  const requests = [{ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'claude-code', version: '2.1.199' } } }, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }];
  for (const legacy of [false, true]) {
    const result = runScript('mcp', configuredEnvironment(root, 'team-notes', legacy), requests.map(request => JSON.stringify(request)).join('\n') + '\n', unrelated);
    assert.equal(result.status, 0, result.stderr);
    const responses = result.stdout.trim().split('\n').map(line => JSON.parse(line));
    assert.equal(responses.find(response => response.id === 1).result.serverInfo.name, 'edw-doc');
    const tools = responses.find(response => response.id === 2).result.tools;
    const approval = tools.find(tool => tool.name === 'vault_begin');
    assert.ok(approval.description.includes(fs.realpathSync(root)), 'Approval describes the configured root, not the launch directory.');
    assert.ok(approval.description.includes('team-notes/'));
  }
  assert.deepEqual(await hashes(root), before);
  assert.deepEqual(await hashes(unrelated), {});
});

test('freshness and lifecycle hooks honor canonical and legacy roots without blocking or writing project files', async t => {
  const root = await fixture(t, 'security');
  const unrelated = await temporaryDirectory(t, 'edw-doc-hook-unrelated-');
  await (await createEngine(root, { vaultName: 'team-notes' })).scan();
  fs.appendFileSync(path.join(root, sourcePath), '\n// New input awaiting documentation sync.\n');
  const before = await hashes(root);
  for (const legacy of [false, true]) {
    const env = configuredEnvironment(root, 'team-notes', legacy);
    const sessionId = randomUUID();
    const event = { hook_event_name: 'SessionStart', session_id: sessionId, cwd: unrelated };
    const freshness = runScript('session-start', env, JSON.stringify(event), unrelated);
    assert.equal(freshness.status, 0, freshness.stderr);
    assert.match(JSON.parse(freshness.stdout).hookSpecificOutput.additionalContext, /EDW Doc.*\/edw-doc:sync/);
    const start = runScript('run-lifecycle', env, JSON.stringify(event), unrelated);
    assert.equal(start.status, 0, start.stderr);
    assert.equal(start.stdout, '');
    const authorization = createRunAuthorization(root);
    const grant = authorization.begin({ command: 'status', session_id: sessionId }, { name: 'claude-code', version: '2.1.199' });
    assert.doesNotThrow(() => authorization.check(grant.run_id, 'vault_status'));
    const stop = runScript('run-lifecycle', env, JSON.stringify({ ...event, hook_event_name: 'SubagentStop', agent_type: 'edw-doc:curator' }), unrelated);
    assert.equal(stop.status, 0, stop.stderr);
    assert.equal(stop.stdout, '');
    assert.throws(() => authorization.check(grant.run_id, 'vault_status'), /ended|expired/);
  }
  assert.deepEqual(await hashes(root), before);
  assert.deepEqual(await hashes(unrelated), {});
});
