import fs from 'node:fs';
import path from 'node:path';
import { gitRead } from './inventory.mjs';
import { checkedPath, ensureIgnore, readBytes, removeOwnedFile, rootDirectory, sha256, validateVaultName, writeAtomic } from './security.mjs';

const BASE = '.claude/doc-vault';
const MANIFEST = `${BASE}/manifest.json`;
const CONFIG = `${BASE}/config.json`;
const INSTRUCTIONS = `${BASE}/instructions.md`;
const RULE = '.claude/rules/doc-vault.md';
const ENTRYPOINTS = new Set(['CLAUDE.md', '.claude/CLAUDE.md', 'AGENTS.md', '.claude/AGENTS.md', RULE]);
const OWNED_FILES = new Set([INSTRUCTIONS, CONFIG, RULE, 'CLAUDE.md']);
const HASH = /^[a-f0-9]{64}$/;
const ACTIVATION_WARNING = 'Instruction loading is unverified: host version, global instructions, managed policy, and enabled plugins may affect activation.';

function rootForSetup(input) {
  const root = rootDirectory(input);
  const top = gitRead(root, ['rev-parse', '--show-toplevel']);
  if (!top || rootDirectory(top.trim()) !== root) throw new Error('Setup requires an inspectable Git repository root. Restore Git access or select the repository root.');
  if (gitRead(root, ['ls-files', '-z']) === null) throw new Error('Cannot inspect Git tracking; no integration files were changed.');
  return root;
}

function exists(root, file, { writable = false } = {}) {
  const absolute = checkedPath(root, file, { allowMissing: true, write: writable });
  if (!fs.existsSync(absolute)) return false;
  if (!fs.lstatSync(absolute).isFile()) throw new Error(`Expected an ordinary file: ${file}`);
  return true;
}

function tracked(root, file) {
  const result = gitRead(root, ['ls-files', '-z', '--', file]);
  if (result === null) throw new Error('Cannot inspect Git tracking; no integration files were changed.');
  return result.length > 0;
}

function ignored(root, file) {
  const result = gitRead(root, ['check-ignore', '--no-index', '-z', '--stdin'], `${file}\0`);
  if (result === null) throw new Error('Cannot inspect Git ignore rules.');
  return result.length > 0;
}

function requireUntracked(root, file) {
  if (tracked(root, file)) throw new Error(`Refusing to modify tracked integration content: ${file}`);
  checkedPath(root, file, { allowMissing: true, write: true });
}

function importLine(entrypoint) {
  return `@${path.posix.relative(path.posix.dirname(entrypoint), INSTRUCTIONS)}`;
}

function markedBlock(entrypoint, eol = '\n') {
  return ['<!-- doc-vault:begin -->', importLine(entrypoint), '<!-- doc-vault:end -->', ''].join(eol);
}

function importsInMarkdown(bytes, { requireClosed = false } = {}) {
  // Imports shown as examples or comments do not activate instructions.
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (requireClosed && source.lastIndexOf('<!--') > source.lastIndexOf('-->')) throw new Error('An open HTML comment would swallow an appended import.');
  const text = source.replace(/<!--[\s\S]*?(?:-->|$)/g, '');
  const imports = [];
  let fence = null;
  for (const line of text.split(/\r?\n/)) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
      continue;
    }
    if (fence || /^(?: {4}|\t)/.test(line)) continue;
    const plain = line.replace(/(`+)[\s\S]*?\1/g, '');
    for (const match of plain.matchAll(/(?:^|\s)@([^\s`]+)/g)) imports.push(match[1]);
  }
  if (requireClosed && fence) throw new Error('An open code fence would swallow an appended import.');
  return imports;
}

function hasInstructionImport(root, entrypoint) {
  const visited = new Set();
  const visit = (file, depth) => {
    if (depth > 4 || visited.size >= 32 || visited.has(file)) return false;
    visited.add(file);
    let imports;
    try { imports = importsInMarkdown(readBytes(root, file, 1024 * 1024)); }
    catch { return false; }
    for (const imported of imports) {
      if (imported.includes('\\') || path.posix.isAbsolute(imported) || path.win32.isAbsolute(imported)) continue;
      const destination = path.posix.normalize(path.posix.join(path.posix.dirname(file), imported));
      if (destination === '..' || destination.startsWith('../')) continue;
      if (destination === INSTRUCTIONS) return true;
      if (destination.endsWith('.md') && visit(destination, depth + 1)) return true;
    }
    return false;
  };
  return visit(entrypoint, 0);
}

function instructionText(vaultName) {
  return `# Doc Vault local maintenance\n\nThis file applies only to the Doc Vault documentation workflow. It does not restrict the host coding agent's normal, user-authorized repository work.\n\n1. Read source through the plugin's documentation tools; write generated documentation only inside \`${vaultName}/\`. Setup alone owns the local integration and narrow ignore-file additions.\n2. Hook notices are reminders only. Run \`/doc-vault:sync\` when the user requests documentation work; never pause or extend an ordinary coding task to force maintenance.\n3. Reconcile the current checkout before publication. Changed, new, renamed, and deleted sources can invalidate dependent notes, flows, onboarding pages, diagrams, and standards assessments. Preserve annotations and user-edited generated files.\n4. Request the single command approval through vault_begin when a Doc Vault skill starts, reuse its run_id across batches, and close it with vault_end. Respect declined approval and never retry it automatically.\n5. Distinguish current source coverage from completed AI review. Do not claim freshness, compliance, or human approval without evidence. Standards review and approval remain separate work.\n6. Explain purpose, inputs, outputs, ordered steps, checks, failure paths, and source-backed findings in simple language. Use numbered procedures when order matters, small Mermaid diagrams for supported flows, and ordinary wiki links for navigation.\n\nMaintenance runs during supported host events. External edits are caught at the next reconciliation; there is no always-on background AI worker. The optional command-line watcher performs static refresh only. Plugin hooks must be loaded for automatic event handling.\n`;
}

function configFor(vaultName) {
  return { version: 1, vaultName, maintenance: { enabled: true } };
}

function validConfig(value, vaultName) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['version', 'vaultName', 'maintenance'].includes(key)) || value.version !== 1) throw new Error('Unsupported integration configuration.');
  validateVaultName(value.vaultName);
  if (value.vaultName !== vaultName) throw new Error('Configuration vaultName differs from the installed integration. Remove and set up the integration for the new vault name.');
  if (!value.maintenance || typeof value.maintenance !== 'object' || Array.isArray(value.maintenance) || Object.keys(value.maintenance).some(key => key !== 'enabled') || typeof value.maintenance.enabled !== 'boolean') throw new Error('maintenance.enabled must be a boolean.');
  return value;
}

function loadManifest(root) {
  if (!exists(root, MANIFEST, { writable: true })) return null;
  const state = JSON.parse(readBytes(root, MANIFEST, 128 * 1024).toString('utf8'));
  if (!state || state.version !== 1 || !ENTRYPOINTS.has(state.entrypoint) || !Array.isArray(state.entries) || state.entries.length > 4 || (state.removed !== undefined && state.removed !== true)) throw new Error('Invalid integration ownership manifest.');
  validateVaultName(state.vaultName);
  const seen = new Set();
  for (const entry of state.entries) {
    if (!entry || seen.has(entry.path) || !HASH.test(entry.sha256)) throw new Error('Invalid integration ownership record.');
    seen.add(entry.path);
    if (entry.kind === 'file') {
      if (!OWNED_FILES.has(entry.path)) throw new Error('Ownership record is outside the integration file allowlist.');
    } else if (entry.kind === 'block') {
      if (!ENTRYPOINTS.has(entry.path) || entry.path === RULE || entry.path !== state.entrypoint) throw new Error('Invalid integration block location.');
      const allowed = ['\n', '\r\n'].flatMap(eol => [markedBlock(entry.path, eol), `${eol}${markedBlock(entry.path, eol)}`]);
      if (!allowed.includes(entry.content) || sha256(entry.content) !== entry.sha256) throw new Error('Invalid integration block content.');
    } else throw new Error('Unknown integration ownership kind.');
  }
  return state;
}

function json(value) { return `${JSON.stringify(value, null, 2)}\n`; }

function currentBytes(root, file) {
  return exists(root, file, { writable: true }) ? readBytes(root, file, 1024 * 1024) : null;
}

function appendRootIgnore(root) {
  if (ignored(root, 'CLAUDE.md')) return false;
  const before = currentBytes(root, '.gitignore') || Buffer.alloc(0);
  const text = before.toString('utf8');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  writeAtomic(root, '.gitignore', Buffer.concat([before, Buffer.from(`${text && !text.endsWith('\n') ? eol : ''}/CLAUDE.md${eol}`)]));
  return true;
}

function chooseEntrypoint(root, warnings) {
  const candidates = ['CLAUDE.md', '.claude/CLAUDE.md', 'AGENTS.md', '.claude/AGENTS.md', 'CLAUDE.local.md', '.claude/CLAUDE.local.md', 'AGENT.md'];
  const present = new Set(candidates.filter(file => exists(root, file)));
  if (present.has('CLAUDE.local.md') || present.has('.claude/CLAUDE.local.md')) {
    warnings.push('Existing local Claude instructions were preserved; the ignored rule adapter avoids changing instruction precedence.');
    return { path: RULE, kind: 'file' };
  }
  const claude = ['CLAUDE.md', '.claude/CLAUDE.md'].filter(file => present.has(file));
  if (claude.length === 1) {
    const file = claude[0];
    if (hasInstructionImport(root, file)) return { path: file, kind: 'reuse' };
    if (!tracked(root, file) && ignored(root, file)) {
      try {
        const bytes = readBytes(root, file, 1024 * 1024);
        if (bytes.includes(0)) throw new Error('Unsupported instruction encoding.');
        importsInMarkdown(bytes, { requireClosed: true });
        return { path: file, kind: 'block' };
      } catch {
        warnings.push(`Preserved ${file}: its contents cannot safely receive a managed block; setup uses the local rule adapter.`);
        return { path: RULE, kind: 'file' };
      }
    }
    warnings.push(`Preserved ${file}: existing tracked or unignored instructions use the ignored rule adapter.`);
    return { path: RULE, kind: 'file' };
  }
  if (present.size) {
    warnings.push('Existing instruction files were preserved. Host support or instruction precedence cannot be verified, so setup uses an ignored rule adapter. AGENT.md is not assumed to load automatically.');
    return { path: RULE, kind: 'file' };
  }
  return { path: 'CLAUDE.md', kind: 'file' };
}

function desiredFile(file, vaultName) {
  if (file === INSTRUCTIONS) return instructionText(vaultName);
  if (file === CONFIG) return json(configFor(vaultName));
  if (file === RULE) return '# Doc Vault integration\n\nFor the Doc Vault documentation workflow, read `.claude/doc-vault/instructions.md` from this repository before maintenance. Follow that file only for Doc Vault work; preserve the host coding agent\'s normal permissions.\n';
  if (file === 'CLAUDE.md') return `# Local project instructions\n\n${markedBlock(file)}`;
  throw new Error('Unsupported integration output.');
}

function occurrences(bytes, needle) {
  const positions = [];
  for (let position = bytes.indexOf(needle); position >= 0; position = bytes.indexOf(needle, position + needle.length)) positions.push(position);
  return positions;
}

export function integrationStatus(rootInput) {
  const root = rootDirectory(rootInput);
  // Ordinary analysis and read-only session hints also work outside Git. Only
  // an installed integration requires the stricter setup metadata contract.
  if (!exists(root, MANIFEST, { writable: true })) return { installed: false, activation: 'unverified', maintenanceEnabled: false, warnings: [] };
  rootForSetup(root);
  const state = loadManifest(root);
  if (!state) return { installed: false, activation: 'unverified', maintenanceEnabled: false, warnings: [] };
  const warnings = [ACTIVATION_WARNING];
  let maintenanceEnabled = false;
  try { maintenanceEnabled = validConfig(JSON.parse(readBytes(root, CONFIG, 32 * 1024)), state.vaultName).maintenance.enabled; }
  catch (error) { warnings.push(`Maintenance disabled: ${error.message}`); }
  if (state.removed || !state.entries.some(entry => entry.path === INSTRUCTIONS) || !state.entries.some(entry => entry.path === CONFIG)) {
    maintenanceEnabled = false;
    warnings.push('Integration removal is incomplete or required ownership records are missing; automatic maintenance is disabled.');
  }
  if (tracked(root, MANIFEST)) { maintenanceEnabled = false; warnings.push('Integration manifest is tracked; automatic maintenance is disabled.'); }
  if (!state.entries.some(entry => entry.path === state.entrypoint) && !hasInstructionImport(root, state.entrypoint)) {
    maintenanceEnabled = false;
    warnings.push('The reused instruction reference is no longer present; automatic maintenance is disabled.');
  }
  for (const entry of state.entries) {
    const bytes = currentBytes(root, entry.path);
    const unchanged = bytes && (entry.kind === 'block' ? occurrences(bytes, Buffer.from(entry.content)).length === 1 : sha256(bytes) === entry.sha256);
    if (!unchanged && entry.path !== CONFIG) { warnings.push(`Missing or edited integration content preserved: ${entry.path}`); maintenanceEnabled = false; }
    if (tracked(root, entry.path)) { warnings.push(`Integration content is tracked: ${entry.path}`); maintenanceEnabled = false; }
  }
  return { installed: !state.removed, vaultName: state.vaultName, entrypoint: state.entrypoint, activation: 'unverified', maintenanceEnabled, warnings };
}

export function installIntegration(rootInput, { vaultName = 'edw-doc' } = {}) {
  validateVaultName(vaultName);
  const root = rootForSetup(rootInput);
  const warnings = [];
  const changes = [];
  const prior = loadManifest(root);
  if (prior?.removed) throw new Error('User-edited content from a removed integration remains. Review the preserved ownership record before installing again.');
  requireUntracked(root, MANIFEST);
  if (tracked(root, vaultName)) throw new Error('The configured vault contains tracked files. Choose an untracked vault before setup.');
  const vaultPath = checkedPath(root, vaultName, { allowMissing: true, write: true });
  if (fs.existsSync(vaultPath) && !fs.lstatSync(vaultPath).isDirectory()) throw new Error('The configured vault path must be an ordinary directory.');
  checkedPath(root, '.gitignore', { allowMissing: true, write: true });
  if (prior && prior.vaultName !== vaultName) throw new Error('An integration for another vault already exists. Remove it before setting up a different vault.');
  const state = prior || { version: 1, vaultName, entrypoint: null, entries: [] };
  const planned = [];
  if (!prior) {
    const selected = chooseEntrypoint(root, warnings);
    state.entrypoint = selected.path;
    for (const file of [INSTRUCTIONS, CONFIG, ...(selected.kind === 'file' ? [selected.path] : [])]) {
      requireUntracked(root, file);
      if (exists(root, file, { writable: true })) throw new Error(`Integration namespace collision; existing file preserved: ${file}`);
      const content = desiredFile(file, vaultName);
      planned.push({ path: file, content: Buffer.from(content), before: null });
      state.entries.push({ path: file, kind: 'file', sha256: sha256(content) });
    }
    if (selected.kind === 'reuse') warnings.push(`Existing import reused in ${selected.path}; setup does not own or remove that reference.`);
    if (selected.kind === 'block') {
      requireUntracked(root, selected.path);
      const before = readBytes(root, selected.path, 1024 * 1024);
      const text = before.toString('utf8');
      const imported = hasInstructionImport(root, selected.path);
      if (!imported) {
        if (text.includes('<!-- doc-vault:begin -->') || text.includes('<!-- doc-vault:end -->')) throw new Error('Unowned Doc Vault markers already exist; preserve and review them before setup.');
        const eol = text.includes('\r\n') ? '\r\n' : '\n';
        const content = `${before.length && !text.endsWith('\n') ? eol : ''}${markedBlock(selected.path, eol)}`;
        planned.push({ path: selected.path, content: Buffer.concat([before, Buffer.from(content)]), before });
        state.entries.push({ path: selected.path, kind: 'block', sha256: sha256(content), content });
      } else warnings.push(`Existing import reused in ${selected.path}; setup does not own or remove that reference.`);
    }
  } else {
    for (const entry of state.entries) {
      requireUntracked(root, entry.path);
      const before = currentBytes(root, entry.path);
      if (entry.path === CONFIG) {
        if (before) validConfig(JSON.parse(before.toString('utf8')), vaultName);
        else warnings.push('Configuration is missing; maintenance remains disabled. Remove and set up the integration to restore it.');
        continue;
      }
      if (entry.kind === 'block') {
        if (!before || occurrences(before, Buffer.from(entry.content)).length !== 1) warnings.push(`Edited or missing integration block preserved: ${entry.path}`);
        continue;
      }
      if (!before || sha256(before) !== entry.sha256) { warnings.push(`Edited or missing integration file preserved: ${entry.path}`); continue; }
      const content = Buffer.from(desiredFile(entry.path, vaultName));
      if (!content.equals(before)) { planned.push({ path: entry.path, content, before }); entry.sha256 = sha256(content); }
    }
  }
  // Preflight all destinations before even the narrow ignore-file mutation.
  for (const operation of planned) requireUntracked(root, operation.path);
  if (ensureIgnore(root, vaultName)) changes.push('.gitignore');
  if (!prior && state.entries.some(entry => entry.path === 'CLAUDE.md' && entry.kind === 'file') && appendRootIgnore(root)) changes.push('.gitignore');
  for (const operation of planned) {
    requireUntracked(root, operation.path);
    const actual = currentBytes(root, operation.path);
    if (operation.before ? !actual?.equals(operation.before) : actual !== null) throw new Error(`Integration destination changed during setup: ${operation.path}`);
    writeAtomic(root, operation.path, operation.content);
    changes.push(operation.path);
  }
  requireUntracked(root, MANIFEST);
  const nextManifest = json(state);
  if (!exists(root, MANIFEST) || readBytes(root, MANIFEST).toString('utf8') !== nextManifest) { writeAtomic(root, MANIFEST, nextManifest); changes.push(MANIFEST); }
  const status = integrationStatus(root);
  return { ...status, changes: [...new Set(changes)], warnings: [...new Set([...warnings, ...status.warnings])] };
}

export function removeIntegration(rootInput) {
  const root = rootForSetup(rootInput);
  const state = loadManifest(root);
  if (!state) return { installed: false, removed: [], preserved: [], warnings: [] };
  requireUntracked(root, MANIFEST);
  const removed = [], preserved = [], remaining = [], operations = [];
  for (const entry of state.entries) {
    // Tracked or unsafe paths block uninstall before any file is modified.
    requireUntracked(root, entry.path);
    const bytes = currentBytes(root, entry.path);
    if (!bytes) continue;
    if (entry.kind === 'file' && sha256(bytes) === entry.sha256) operations.push({ entry, before: bytes, content: null });
    else if (entry.kind === 'block') {
      const needle = Buffer.from(entry.content);
      const positions = occurrences(bytes, needle);
      if (positions.length === 1) operations.push({ entry, before: bytes, content: Buffer.concat([bytes.subarray(0, positions[0]), bytes.subarray(positions[0] + needle.length)]) });
      else { preserved.push(entry.path); remaining.push(entry); }
    } else { preserved.push(entry.path); remaining.push(entry); }
  }
  for (const operation of operations) {
    requireUntracked(root, operation.entry.path);
    if (!currentBytes(root, operation.entry.path)?.equals(operation.before)) throw new Error(`Integration destination changed during removal: ${operation.entry.path}`);
    if (operation.content === null) removeOwnedFile(root, operation.entry.path);
    else writeAtomic(root, operation.entry.path, operation.content);
    removed.push(operation.entry.path);
  }
  requireUntracked(root, MANIFEST);
  if (remaining.length) writeAtomic(root, MANIFEST, json({ ...state, removed: true, entries: remaining }));
  else { removeOwnedFile(root, MANIFEST); removed.push(MANIFEST); }
  const warnings = preserved.length ? ['User-edited integration content and its ownership record were retained. Automatic maintenance is disabled; ignore rules and directories are always preserved.'] : [];
  if (removed.includes(INSTRUCTIONS) && !state.entries.some(entry => entry.path === state.entrypoint) && hasInstructionImport(root, state.entrypoint)) warnings.push(`Existing unowned instruction reference remains in ${state.entrypoint}, but its Doc Vault target was removed. Review that reference manually; uninstall did not edit it.`);
  return { installed: false, removed, preserved, warnings };
}
