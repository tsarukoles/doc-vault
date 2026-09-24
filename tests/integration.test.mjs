import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { installIntegration, integrationStatus, removeIntegration } from '../src/integration.mjs';
import { temporaryDirectory, hashes } from './helpers.mjs';

const MANIFEST = '.claude/doc-vault/manifest.json';
const CONFIG = '.claude/doc-vault/config.json';
const INSTRUCTIONS = '.claude/doc-vault/instructions.md';
const RULE = '.claude/rules/doc-vault.md';
const git = (root, ...args) => execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, '-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
const write = (root, file, content) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), content); };
const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8');
const has = (root, file) => fs.existsSync(path.join(root, file));
async function repo(t) {
  const root = await temporaryDirectory(t, 'doc-vault-integration-');
  git(root, 'init', '--quiet');
  return root;
}

test('setup creates ignored local integration and missing ignore file, and reinstall is byte-idempotent', async t => {
  const root = await repo(t);
  const result = installIntegration(root);
  assert.equal(result.installed, true);
  assert.equal(result.entrypoint, 'CLAUDE.md');
  assert.equal(result.maintenanceEnabled, true);
  assert.equal(result.activation, 'unverified');
  assert.match(read(root, 'CLAUDE.md'), /@\.claude\/doc-vault\/instructions\.md/);
  assert.match(read(root, '.gitignore'), /\/edw-doc\/\n\/\.claude\/\n\/CLAUDE.md\n/);
  assert.equal(has(root, 'CLAUDE.local.md'), false);
  const before = await hashes(root);
  assert.deepEqual(installIntegration(root).changes, []);
  assert.deepEqual(await hashes(root), before);
  assert.equal(git(root, 'status', '--porcelain').trim(), '?? .gitignore');
});

test('local ignored instructions preserve BOM, CRLF, existing text, and later unrelated edits on uninstall', async t => {
  const root = await repo(t);
  const original = Buffer.from('\uFEFF# My instructions\r\nRead carefully.');
  write(root, '.gitignore', '/CLAUDE.md\r\n');
  write(root, 'CLAUDE.md', original);
  const result = installIntegration(root);
  assert.equal(result.entrypoint, 'CLAUDE.md');
  const installed = fs.readFileSync(path.join(root, 'CLAUDE.md'));
  assert.ok(installed.subarray(0, original.length).equals(original));
  assert.match(installed.toString('utf8'), /\r\n<!-- doc-vault:begin -->\r\n/);
  fs.appendFileSync(path.join(root, 'CLAUDE.md'), '\r\nMy later guidance.\r\n');
  const resultRemove = removeIntegration(root);
  assert.equal(resultRemove.installed, false);
  assert.equal(read(root, 'CLAUDE.md'), `${original.toString('utf8')}\r\nMy later guidance.\r\n`);
  assert.equal(has(root, '.claude'), true);
  assert.match(read(root, '.gitignore'), /\/\.claude\//);
});

test('tracked root instructions and existing settings/hooks are untouched; only the local adapter is added', async t => {
  const root = await repo(t);
  write(root, 'CLAUDE.md', '# Shared guidance\n');
  write(root, '.claude/settings.json', '{"hooks":{"Stop":[]}}\n');
  write(root, '.claude/agents/custom.md', '# Custom agent\n');
  git(root, 'add', '--', 'CLAUDE.md', '.claude/settings.json');
  const result = installIntegration(root);
  assert.equal(result.entrypoint, RULE);
  assert.equal(read(root, 'CLAUDE.md'), '# Shared guidance\n');
  assert.equal(read(root, '.claude/settings.json'), '{"hooks":{"Stop":[]}}\n');
  assert.equal(read(root, '.claude/agents/custom.md'), '# Custom agent\n');
  assert.match(read(root, RULE), /read `\.claude\/doc-vault\/instructions.md`/);
  assert.doesNotMatch(read(root, '.gitignore'), /\/CLAUDE.md/);
});

test('existing unignored instructions use a local adapter and are not silently hidden from Git', async t => {
  const root = await repo(t);
  write(root, 'CLAUDE.md', '# Intended shared instructions\n');
  assert.equal(installIntegration(root).entrypoint, RULE);
  assert.equal(read(root, 'CLAUDE.md'), '# Intended shared instructions\n');
  assert.doesNotMatch(read(root, '.gitignore'), /\/CLAUDE.md/);
});

test('existing ignored .claude/CLAUDE.md gets an import relative to its containing file', async t => {
  const root = await repo(t);
  write(root, '.gitignore', '/.claude/\n');
  write(root, '.claude/CLAUDE.md', '# Local instructions\n');
  assert.equal(installIntegration(root).entrypoint, '.claude/CLAUDE.md');
  assert.match(read(root, '.claude/CLAUDE.md'), /^@doc-vault\/instructions.md$/m);
  assert.equal(has(root, 'CLAUDE.md'), false);
});

test('AGENTS, custom AGENT, and existing CLAUDE.local precedence use a conservative rule adapter', async t => {
  for (const file of ['AGENTS.md', 'AGENT.md', 'CLAUDE.local.md', '.claude/AGENTS.md']) {
    const root = await repo(t);
    write(root, file, '# Preserve this\n');
    assert.equal(installIntegration(root).entrypoint, RULE);
    assert.equal(read(root, file), '# Preserve this\n');
    assert.equal(has(root, 'CLAUDE.md'), false);
    if (file !== 'CLAUDE.local.md') assert.equal(has(root, 'CLAUDE.local.md'), false);
  }
});

test('existing direct import is reused, never duplicated or removed as an owned block', async t => {
  const root = await repo(t);
  const original = '# My instructions\n@.claude/doc-vault/instructions.md\n';
  write(root, '.gitignore', '/CLAUDE.md\n');
  write(root, 'CLAUDE.md', original);
  installIntegration(root);
  assert.equal(read(root, 'CLAUDE.md'), original);
  const removal = removeIntegration(root);
  assert.ok(removal.warnings.some(warning => warning.includes('unowned instruction reference')));
  assert.equal(read(root, 'CLAUDE.md'), original);
});

test('a tracked instruction file with an existing import is reused without an extra adapter', async t => {
  const root = await repo(t);
  const original = '# Shared\n@.claude/doc-vault/instructions.md\n';
  write(root, 'CLAUDE.md', original);
  git(root, 'add', '--', 'CLAUDE.md');
  assert.equal(installIntegration(root).entrypoint, 'CLAUDE.md');
  assert.equal(has(root, RULE), false);
  assert.equal(read(root, 'CLAUDE.md'), original);
  const removal = removeIntegration(root);
  assert.ok(removal.warnings.some(warning => warning.includes('unowned instruction reference')));
  assert.equal(read(root, 'CLAUDE.md'), original);
});

test('imports inside fenced code, inline code, or comments never count as active references', async t => {
  const root = await repo(t);
  const original = '# Examples only\n```md\n@.claude/doc-vault/instructions.md\n```\n<!--\n@.claude/doc-vault/instructions.md\n-->\n`@.claude/doc-vault/instructions.md`\n';
  write(root, '.gitignore', '/CLAUDE.md\n');
  write(root, 'CLAUDE.md', original);
  installIntegration(root);
  assert.ok(read(root, 'CLAUDE.md').startsWith(original));
  assert.match(read(root, 'CLAUDE.md'), /<!-- doc-vault:begin -->\n@\.claude\/doc-vault\/instructions.md\n<!-- doc-vault:end -->/);
  removeIntegration(root);
  assert.equal(read(root, 'CLAUDE.md'), original);
});

test('bounded repository-local import chains are reused and do not gain duplicate references', async t => {
  const root = await repo(t);
  write(root, '.gitignore', '/CLAUDE.md\n');
  write(root, 'CLAUDE.md', '# Local\n@docs/local-instructions.md\n');
  write(root, 'docs/local-instructions.md', '# Additional\n@../.claude/doc-vault/instructions.md\n');
  const original = read(root, 'CLAUDE.md');
  installIntegration(root);
  assert.equal(read(root, 'CLAUDE.md'), original);
  assert.equal(integrationStatus(root).maintenanceEnabled, true);
  write(root, 'docs/local-instructions.md', '# Import intentionally removed\n');
  assert.equal(integrationStatus(root).maintenanceEnabled, false);
  removeIntegration(root);
  assert.equal(read(root, 'CLAUDE.md'), original);
});

test('unsupported instruction encoding is preserved and uses the local rule adapter', async t => {
  const root = await repo(t);
  write(root, '.gitignore', '/CLAUDE.md\n');
  const original = Buffer.from('\uFEFF# UTF16 instructions\n', 'utf16le');
  write(root, 'CLAUDE.md', original);
  assert.equal(installIntegration(root).entrypoint, RULE);
  assert.ok(fs.readFileSync(path.join(root, 'CLAUDE.md')).equals(original));
});

test('unclosed code fences or comments cannot swallow an appended integration reference', async t => {
  for (const original of ['# Work in progress\n```md\nexample\n', '# Work in progress\n<!-- unclosed comment\n']) {
    const root = await repo(t);
    write(root, '.gitignore', '/CLAUDE.md\n');
    write(root, 'CLAUDE.md', original);
    assert.equal(installIntegration(root).entrypoint, RULE);
    assert.equal(read(root, 'CLAUDE.md'), original);
  }
});

test('namespace collisions fail before any ignore or other integration change', async t => {
  for (const file of [INSTRUCTIONS, CONFIG, RULE]) {
    const root = await repo(t);
    write(root, 'CLAUDE.md', '# Shared root\n');
    write(root, file, 'User content\n');
    const before = await hashes(root);
    assert.throws(() => installIntegration(root), /collision|ownership/i);
    assert.deepEqual(await hashes(root), before);
  }
});

test('a modified owned file and a valid user configuration are preserved on reinstall and removal', async t => {
  const root = await repo(t);
  installIntegration(root);
  write(root, INSTRUCTIONS, '# User revised guidance\n');
  const config = { version: 1, vaultName: 'edw-doc', maintenance: { enabled: false } };
  write(root, CONFIG, JSON.stringify(config));
  const result = installIntegration(root);
  assert.equal(result.maintenanceEnabled, false);
  assert.equal(read(root, INSTRUCTIONS), '# User revised guidance\n');
  assert.equal(read(root, CONFIG), JSON.stringify(config));
  const removal = removeIntegration(root);
  assert.ok(removal.preserved.includes(INSTRUCTIONS));
  assert.ok(removal.preserved.includes(CONFIG));
  assert.equal(read(root, CONFIG), JSON.stringify(config));
  assert.equal(integrationStatus(root).installed, false);
  assert.equal(integrationStatus(root).maintenanceEnabled, false);
});

test('modified managed import block is preserved on reinstall and uninstall', async t => {
  const root = await repo(t);
  write(root, '.gitignore', '/CLAUDE.md\n');
  write(root, 'CLAUDE.md', '# User rules\n');
  installIntegration(root);
  const revised = read(root, 'CLAUDE.md').replace('@.claude/doc-vault/instructions.md', '@my-own-instructions.md');
  write(root, 'CLAUDE.md', revised);
  installIntegration(root);
  assert.equal(read(root, 'CLAUDE.md'), revised);
  assert.ok(removeIntegration(root).preserved.includes('CLAUDE.md'));
  assert.equal(read(root, 'CLAUDE.md'), revised);
});

test('a file tracked after setup blocks setup and uninstall before writes', async t => {
  const root = await repo(t);
  installIntegration(root);
  git(root, 'add', '--force', '--', CONFIG);
  const before = await hashes(root);
  assert.equal(integrationStatus(root).maintenanceEnabled, false);
  assert.throws(() => installIntegration(root), /tracked/i);
  assert.throws(() => removeIntegration(root), /tracked/i);
  assert.deepEqual(await hashes(root), before);
});

test('tracked manifests and missing or modified instructions disable automatic maintenance', async t => {
  for (const mutation of ['tracked-manifest', 'missing-instructions', 'edited-instructions']) {
    const root = await repo(t);
    installIntegration(root);
    if (mutation === 'tracked-manifest') git(root, 'add', '--force', '--', MANIFEST);
    else if (mutation === 'missing-instructions') fs.unlinkSync(path.join(root, INSTRUCTIONS));
    else write(root, INSTRUCTIONS, '# Edited guidance\n');
    assert.equal(integrationStatus(root).maintenanceEnabled, false, mutation);
  }
});

test('invalid configuration disables maintenance and is never replaced by setup', async t => {
  const root = await repo(t);
  installIntegration(root);
  write(root, CONFIG, '{"version":1,"vaultName":"../outside","maintenance":{"enabled":true}}');
  const before = await hashes(root);
  assert.equal(integrationStatus(root).maintenanceEnabled, false);
  assert.throws(() => installIntegration(root), /vault|configuration/i);
  assert.deepEqual(await hashes(root), before);
});

test('forged manifest cannot grant writes to source files or arbitrary instruction blocks', async t => {
  const root = await repo(t);
  installIntegration(root);
  write(root, 'source.js', 'export const keep = true;\n');
  const original = JSON.parse(read(root, MANIFEST));
  const forged = structuredClone(original);
  forged.entries[0].path = 'source.js';
  write(root, MANIFEST, JSON.stringify(forged));
  const before = await hashes(root);
  assert.throws(() => removeIntegration(root), /allowlist/);
  assert.deepEqual(await hashes(root), before);
  forged.entries[0] = { path: 'CLAUDE.md', kind: 'block', content: '# Shared policy', sha256: '0'.repeat(64) };
  write(root, MANIFEST, JSON.stringify(forged));
  assert.throws(() => installIntegration(root), /block/);
  assert.equal(read(root, 'source.js'), 'export const keep = true;\n');
});

test('hard-linked instruction and ignore targets cannot mutate content outside the repository', async t => {
  for (const target of ['CLAUDE.md', '.gitignore']) {
    const root = await repo(t);
    const outside = await temporaryDirectory(t, 'doc-vault-integration-external-');
    write(outside, 'original.md', '# Keep external\n');
    if (target === 'CLAUDE.md') write(root, '.gitignore', '/CLAUDE.md\n');
    try { fs.linkSync(path.join(outside, 'original.md'), path.join(root, target)); }
    catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP', 'EXDEV'].includes(error.code)) return t.skip('Hard links unavailable.'); throw error; }
    const before = await hashes(root);
    assert.throws(() => installIntegration(root), /linked|link/i);
    assert.equal(read(outside, 'original.md'), '# Keep external\n');
    assert.deepEqual(await hashes(root), before);
  }
});

test('linked .claude directories are refused before changing repository or external files', async t => {
  const root = await repo(t);
  const outside = await temporaryDirectory(t, 'doc-vault-integration-external-');
  write(outside, 'keep.md', '# Keep\n');
  try { fs.symlinkSync(outside, path.join(root, '.claude'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip('Directory links unavailable.'); throw error; }
  const before = await hashes(root), externalBefore = await hashes(outside);
  assert.throws(() => installIntegration(root), /link|junction/i);
  assert.deepEqual(await hashes(root), before);
  assert.deepEqual(await hashes(outside), externalBefore);
});

test('non-repositories and nested directories fail closed instead of guessing Git tracking', async t => {
  const plain = await temporaryDirectory(t, 'doc-vault-integration-');
  assert.equal(integrationStatus(plain).installed, false);
  assert.throws(() => installIntegration(plain), /Git repository root/);
  assert.equal(has(plain, '.gitignore'), false);
  const root = await repo(t);
  fs.mkdirSync(path.join(root, 'nested'));
  assert.throws(() => installIntegration(path.join(root, 'nested')), /Git repository root/);
  assert.equal(has(root, 'nested/.gitignore'), false);
});

test('a vault name occupied by a regular file is rejected before creating integration files', async t => {
  const root = await repo(t);
  write(root, 'edw-doc', 'Existing source file\n');
  const before = await hashes(root);
  assert.throws(() => installIntegration(root), /ordinary directory/);
  assert.deepEqual(await hashes(root), before);
});

test('Git worktrees work without writing Git metadata or a shared instruction file', async t => {
  const root = await repo(t);
  write(root, 'source.js', 'export const keep = true;\n');
  git(root, 'add', 'source.js');
  git(root, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'fixture');
  const worktreeParent = await temporaryDirectory(t, 'doc-vault-integration-worktree-');
  const worktree = path.join(worktreeParent, 'checkout');
  git(root, 'worktree', 'add', '--quiet', '--detach', worktree);
  const gitBefore = await hashes(path.join(root, '.git'));
  assert.equal(installIntegration(worktree).installed, true);
  assert.deepEqual(await hashes(path.join(root, '.git')), gitBefore);
  assert.equal(has(root, 'CLAUDE.md'), false);
});
