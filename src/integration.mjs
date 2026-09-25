import fs from 'node:fs';
import path from 'node:path';
import { gitRead } from './inventory.mjs';
import { checkedPath, ensureIgnore, readBytes, removeOwnedFile, rootDirectory, sha256, validateVaultName, writeAtomic } from './security.mjs';

function integrationLayout(name) {
  const base = `.claude/${name}`;
  const rule = `.claude/rules/${name}.md`;
  const instructions = `${base}/instructions.md`;
  const config = `${base}/config.json`;
  return { name, manifest: `${base}/manifest.json`, config, instructions, rule,
    entrypoints: new Set(['CLAUDE.md', '.claude/CLAUDE.md', 'AGENTS.md', '.claude/AGENTS.md', rule]),
    ownedFiles: new Set([instructions, config, rule, 'CLAUDE.md']) };
}
const CURRENT_LAYOUT = integrationLayout('edw-doc');
// Existing ownership records must keep their original paths, block bytes, and
// hashes. Renaming them in place would make safe updates/removal impossible.
const LEGACY_LAYOUT = integrationLayout('doc-vault');
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

function importLine(entrypoint, layout) {
  return `@${path.posix.relative(path.posix.dirname(entrypoint), layout.instructions)}`;
}

function markedBlock(entrypoint, layout, eol = '\n') {
  return [`<!-- ${layout.name}:begin -->`, importLine(entrypoint, layout), `<!-- ${layout.name}:end -->`, ''].join(eol);
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

function hasInstructionImport(root, entrypoint, layout) {
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
      if (destination === layout.instructions) return true;
      if (destination.endsWith('.md') && visit(destination, depth + 1)) return true;
    }
    return false;
  };
  return visit(entrypoint, 0);
}

function instructionText(vaultName) {
  return `# EDW Doc local maintenance\n\nThis file applies only to the EDW Doc documentation workflow. It does not restrict the host coding agent's normal, user-authorized repository work.\n\n1. Read source through the plugin's documentation tools; write generated documentation only inside \`${vaultName}/\`. Approved build and sync runs also let the broker create or repair its owned local Claude integration and narrow ignore-file additions; explicit setup performs the same integration work. Preserve existing user content. Do not use native tools to edit source, settings, or scripts for this workflow.\n2. Hook notices are reminders only. Run \`/edw-doc:sync\` when the user requests documentation work; never pause or extend an ordinary coding task to force maintenance.\n3. Reconcile the current checkout before publication. Changed, new, renamed, and deleted sources can invalidate dependent notes, flows, onboarding pages, diagrams, and standards assessments. Preserve annotations and user-edited generated files.\n4. Request the single command approval through vault_begin when an EDW Doc skill starts, reuse its run_id across batches, and close it with vault_end. Respect declined approval and never retry it automatically.\n5. Distinguish current source coverage from completed AI review. Do not claim freshness, compliance, or human approval without evidence. Standards review and approval remain separate work.\n6. Explain purpose, inputs, outputs, ordered steps, checks, failure paths, and source-backed findings in simple language. Use numbered procedures when order matters, small Mermaid diagrams for supported flows, and ordinary wiki links for navigation.\n\nMaintenance runs during supported host events. External edits are caught at the next reconciliation; there is no always-on background AI worker. The optional command-line watcher performs static refresh only. Plugin hooks must be loaded for automatic event handling.\n`;
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

function selectLayout(root) {
  const current = exists(root, CURRENT_LAYOUT.manifest, { writable: true });
  const legacy = exists(root, LEGACY_LAYOUT.manifest, { writable: true });
  if (current && legacy) throw new Error('Both EDW Doc and legacy Doc Vault integration manifests exist. Review them before setup or removal; no integration files were changed.');
  const other = current ? LEGACY_LAYOUT : legacy ? CURRENT_LAYOUT : null;
  if (other && [other.instructions, other.config, other.rule].some(file => exists(root, file))) throw new Error('Conflicting current and legacy integration content exists. Review the duplicate integration before setup or removal; no integration files were changed.');
  return legacy ? LEGACY_LAYOUT : CURRENT_LAYOUT;
}

function loadManifest(root, layout) {
  if (!exists(root, layout.manifest, { writable: true })) return null;
  const state = JSON.parse(readBytes(root, layout.manifest, 128 * 1024).toString('utf8'));
  if (!state || state.version !== 1 || !layout.entrypoints.has(state.entrypoint) || !Array.isArray(state.entries) || state.entries.length > 4 || (state.removed !== undefined && state.removed !== true)) throw new Error('Invalid integration ownership manifest.');
  validateVaultName(state.vaultName);
  const seen = new Set();
  for (const entry of state.entries) {
    if (!entry || seen.has(entry.path) || !HASH.test(entry.sha256)) throw new Error('Invalid integration ownership record.');
    seen.add(entry.path);
    if (entry.kind === 'file') {
      if (!layout.ownedFiles.has(entry.path)) throw new Error('Ownership record is outside the integration file allowlist.');
    } else if (entry.kind === 'block') {
      if (!layout.entrypoints.has(entry.path) || entry.path === layout.rule || entry.path !== state.entrypoint) throw new Error('Invalid integration block location.');
      const allowed = ['\n', '\r\n'].flatMap(eol => [markedBlock(entry.path, layout, eol), `${eol}${markedBlock(entry.path, layout, eol)}`]);
      if (!allowed.includes(entry.content) || sha256(entry.content) !== entry.sha256) throw new Error('Invalid integration block content.');
    } else throw new Error('Unknown integration ownership kind.');
  }
  return state;
}

function assertNoOrphanedLegacyIntegration(root) {
  const legacyFiles = [LEGACY_LAYOUT.instructions, LEGACY_LAYOUT.config, LEGACY_LAYOUT.rule];
  const entrypoints = ['CLAUDE.md', '.claude/CLAUDE.md', 'AGENTS.md', '.claude/AGENTS.md', 'CLAUDE.local.md', '.claude/CLAUDE.local.md', 'AGENT.md'];
  const existingReference = entrypoints.some(file => exists(root, file) && hasInstructionImport(root, file, LEGACY_LAYOUT));
  if (legacyFiles.some(file => exists(root, file)) || existingReference) throw new Error('Legacy Doc Vault integration content or imports remain without an ownership manifest. Preserve and review them before setup to avoid duplicate instructions.');
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

function chooseEntrypoint(root, warnings, layout) {
  const candidates = ['CLAUDE.md', '.claude/CLAUDE.md', 'AGENTS.md', '.claude/AGENTS.md', 'CLAUDE.local.md', '.claude/CLAUDE.local.md', 'AGENT.md'];
  const present = new Set(candidates.filter(file => exists(root, file)));
  const claude = ['CLAUDE.md', '.claude/CLAUDE.md'].filter(file => present.has(file));
  // Other agents' guidance and Claude's local overrides are not a substitute
  // for the project entrypoint. Add our own root file without changing them.
  if (!claude.length) {
    if (tracked(root, 'CLAUDE.md')) {
      warnings.push('The missing root CLAUDE.md is tracked. Its deletion was preserved; setup uses the local rule adapter.');
      return { path: layout.rule, kind: 'file' };
    }
    return { path: 'CLAUDE.md', kind: 'file' };
  }
  const imported = claude.find(file => hasInstructionImport(root, file, layout));
  if (imported) return { path: imported, kind: 'reuse' };
  if (present.has('CLAUDE.local.md') || present.has('.claude/CLAUDE.local.md')) {
    warnings.push('Existing local Claude instructions were preserved; the ignored rule adapter avoids changing instruction precedence.');
    return { path: layout.rule, kind: 'file' };
  }
  if (claude.length === 1) {
    const file = claude[0];
    if (!tracked(root, file) && ignored(root, file)) {
      try {
        const bytes = readBytes(root, file, 1024 * 1024);
        if (bytes.includes(0)) throw new Error('Unsupported instruction encoding.');
        importsInMarkdown(bytes, { requireClosed: true });
        return { path: file, kind: 'block' };
      } catch {
        warnings.push(`Preserved ${file}: its contents cannot safely receive a managed block; setup uses the local rule adapter.`);
        return { path: layout.rule, kind: 'file' };
      }
    }
    warnings.push(`Preserved ${file}: existing tracked or unignored instructions use the ignored rule adapter.`);
    return { path: layout.rule, kind: 'file' };
  }
  if (present.size) {
    warnings.push('Existing instruction files were preserved. Host support or instruction precedence cannot be verified, so setup uses an ignored rule adapter. AGENT.md is not assumed to load automatically.');
    return { path: layout.rule, kind: 'file' };
  }
  return { path: 'CLAUDE.md', kind: 'file' };
}

function desiredFile(file, vaultName, layout) {
  if (file === layout.instructions) return instructionText(vaultName);
  if (file === layout.config) return json(configFor(vaultName));
  if (file === layout.rule) return `# EDW Doc integration\n\nFor the EDW Doc documentation workflow, read \`${layout.instructions}\` from this repository before maintenance. Follow that file only for EDW Doc work; preserve the host coding agent's normal permissions.\n`;
  if (file === 'CLAUDE.md') return `# Local project instructions\n\n${markedBlock(file, layout)}`;
  throw new Error('Unsupported integration output.');
}

function occurrences(bytes, needle) {
  const positions = [];
  for (let position = bytes.indexOf(needle); position >= 0; position = bytes.indexOf(needle, position + needle.length)) positions.push(position);
  return positions;
}

export function integrationStatus(rootInput) {
  const root = rootDirectory(rootInput);
  const layout = selectLayout(root);
  // Ordinary analysis and read-only session hints also work outside Git. Only
  // an installed integration requires the stricter setup metadata contract.
  if (!exists(root, layout.manifest, { writable: true })) return { installed: false, activation: 'unverified', maintenanceEnabled: false, warnings: [] };
  rootForSetup(root);
  const state = loadManifest(root, layout);
  if (!state) return { installed: false, activation: 'unverified', maintenanceEnabled: false, warnings: [] };
  const warnings = [ACTIVATION_WARNING];
  if (layout === LEGACY_LAYOUT) warnings.push('Existing Doc Vault integration paths are retained for compatibility. Setup updates unchanged owned instructions to EDW Doc commands; use uninstall then setup only if you want new integration paths.');
  let maintenanceEnabled = false;
  try { maintenanceEnabled = validConfig(JSON.parse(readBytes(root, layout.config, 32 * 1024)), state.vaultName).maintenance.enabled; }
  catch (error) { warnings.push(`Maintenance disabled: ${error.message}`); }
  if (state.removed || !state.entries.some(entry => entry.path === layout.instructions) || !state.entries.some(entry => entry.path === layout.config)) {
    maintenanceEnabled = false;
    warnings.push('Integration removal is incomplete or required ownership records are missing; automatic maintenance is disabled.');
  }
  if (tracked(root, layout.manifest)) { maintenanceEnabled = false; warnings.push('Integration manifest is tracked; automatic maintenance is disabled.'); }
  if (!state.entries.some(entry => entry.path === state.entrypoint) && !hasInstructionImport(root, state.entrypoint, layout)) {
    maintenanceEnabled = false;
    warnings.push('The reused instruction reference is no longer present; automatic maintenance is disabled.');
  }
  for (const entry of state.entries) {
    const bytes = currentBytes(root, entry.path);
    const unchanged = bytes && (entry.kind === 'block' ? occurrences(bytes, Buffer.from(entry.content)).length === 1 : sha256(bytes) === entry.sha256);
    if (!unchanged && entry.path !== layout.config) { warnings.push(`Missing or edited integration content preserved: ${entry.path}`); maintenanceEnabled = false; }
    if (tracked(root, entry.path)) { warnings.push(`Integration content is tracked: ${entry.path}`); maintenanceEnabled = false; }
  }
  return { installed: !state.removed, vaultName: state.vaultName, entrypoint: state.entrypoint, integrationPath: path.posix.dirname(layout.manifest), activation: 'unverified', maintenanceEnabled, warnings };
}

export function installIntegration(rootInput, options = {}) {
  const root = rootForSetup(rootInput);
  const layout = selectLayout(root);
  const warnings = [];
  const changes = [];
  const repairs = [];
  const prior = loadManifest(root, layout);
  const vaultName = options.vaultName ?? prior?.vaultName ?? 'edw-doc';
  validateVaultName(vaultName);
  if (prior?.removed) throw new Error('User-edited content from a removed integration remains. Review the preserved ownership record before installing again.');
  requireUntracked(root, layout.manifest);
  if (tracked(root, vaultName)) throw new Error('The configured vault contains tracked files. Choose an untracked vault before setup.');
  const vaultPath = checkedPath(root, vaultName, { allowMissing: true, write: true });
  if (fs.existsSync(vaultPath) && !fs.lstatSync(vaultPath).isDirectory()) throw new Error('The configured vault path must be an ordinary directory.');
  checkedPath(root, '.gitignore', { allowMissing: true, write: true });
  if (prior && prior.vaultName !== vaultName) throw new Error('An integration for another vault already exists. Remove it before setting up a different vault.');
  const state = prior || { version: 1, vaultName, entrypoint: null, entries: [] };
  const planned = [];
  if (!prior) {
    assertNoOrphanedLegacyIntegration(root);
    for (const file of [layout.instructions, layout.config, layout.rule]) {
      if (exists(root, file, { writable: true })) throw new Error(`Integration namespace collision; existing file preserved: ${file}`);
    }
    const selected = chooseEntrypoint(root, warnings, layout);
    state.entrypoint = selected.path;
    for (const file of [layout.instructions, layout.config, ...(selected.kind === 'file' ? [selected.path] : [])]) {
      requireUntracked(root, file);
      if (exists(root, file, { writable: true })) throw new Error(`Integration namespace collision; existing file preserved: ${file}`);
      const content = desiredFile(file, vaultName, layout);
      planned.push({ path: file, content: Buffer.from(content), before: null });
      state.entries.push({ path: file, kind: 'file', sha256: sha256(content) });
    }
    if (selected.kind === 'reuse') warnings.push(`Existing import reused in ${selected.path}; setup does not own or remove that reference.`);
    if (selected.kind === 'block') {
      requireUntracked(root, selected.path);
      const before = readBytes(root, selected.path, 1024 * 1024);
      const text = before.toString('utf8');
      const imported = hasInstructionImport(root, selected.path, layout);
      if (!imported) {
        if (text.includes(`<!-- ${layout.name}:begin -->`) || text.includes(`<!-- ${layout.name}:end -->`)) throw new Error('Unowned EDW Doc markers already exist; preserve and review them before setup.');
        const eol = text.includes('\r\n') ? '\r\n' : '\n';
        const content = `${before.length && !text.endsWith('\n') ? eol : ''}${markedBlock(selected.path, layout, eol)}`;
        planned.push({ path: selected.path, content: Buffer.concat([before, Buffer.from(content)]), before });
        state.entries.push({ path: selected.path, kind: 'block', sha256: sha256(content), content });
      } else warnings.push(`Existing import reused in ${selected.path}; setup does not own or remove that reference.`);
    }
  } else {
    const oldRule = state.entrypoint === layout.rule ? state.entries.find(entry => entry.path === layout.rule && entry.kind === 'file') : null;
    const oldRuleBytes = oldRule ? currentBytes(root, layout.rule) : null;
    const missingClaude = !exists(root, 'CLAUDE.md') && !exists(root, '.claude/CLAUDE.md');
    const replaceRule = oldRule && missingClaude && !tracked(root, 'CLAUDE.md') && (!oldRuleBytes || sha256(oldRuleBytes) === oldRule.sha256);
    for (const entry of state.entries) {
      requireUntracked(root, entry.path);
      if (replaceRule && entry === oldRule) continue;
      const before = currentBytes(root, entry.path);
      if (entry.path === layout.config) {
        if (before) validConfig(JSON.parse(before.toString('utf8')), vaultName);
        else {
          // A hash cannot recover a user's deleted maintenance preference.
          // Restore a usable config without turning a possible opt-out on.
          const content = Buffer.from(json({ ...configFor(vaultName), maintenance: { enabled: false } }));
          planned.push({ path: entry.path, content, before: null });
          entry.sha256 = sha256(content);
          repairs.push(entry.path);
          warnings.push('Missing configuration restored for the original vault with maintenance disabled; review config.json before enabling automatic maintenance.');
        }
        continue;
      }
      if (entry.kind === 'block') {
        if (!before) {
          planned.push({ path: entry.path, content: Buffer.from(entry.content), before: null });
          repairs.push(entry.path);
          warnings.push(`Missing instruction entrypoint restored with its owned integration block only: ${entry.path}. Previous user text cannot be recovered by setup.`);
        } else if (occurrences(before, Buffer.from(entry.content)).length !== 1) warnings.push(`Edited integration block preserved: ${entry.path}`);
        continue;
      }
      if (before && sha256(before) !== entry.sha256) { warnings.push(`Edited integration file preserved: ${entry.path}`); continue; }
      const content = Buffer.from(desiredFile(entry.path, vaultName, layout));
      if (!before || !content.equals(before)) { planned.push({ path: entry.path, content, before }); entry.sha256 = sha256(content); }
      if (!before) repairs.push(entry.path);
    }
    if (replaceRule) {
      const content = Buffer.from(desiredFile('CLAUDE.md', vaultName, layout));
      planned.push({ path: 'CLAUDE.md', content, before: null });
      if (oldRuleBytes) planned.push({ path: layout.rule, content: null, before: oldRuleBytes });
      state.entries = state.entries.filter(entry => entry !== oldRule);
      state.entries.push({ path: 'CLAUDE.md', kind: 'file', sha256: sha256(content) });
      state.entrypoint = 'CLAUDE.md';
      repairs.push('CLAUDE.md');
      warnings.push('Missing root CLAUDE.md created; its unchanged owned rule adapter was retired to avoid duplicate instructions.');
    } else if (oldRule && missingClaude) {
      warnings.push('The existing rule adapter was retained because it was edited or the missing root CLAUDE.md is tracked; no duplicate root entrypoint was created.');
    } else if (!state.entries.some(entry => entry.path === state.entrypoint) && !exists(root, state.entrypoint)) {
      // A reused file was never ours to reconstruct. If it disappeared, add
      // only a fresh safe entrypoint, leaving tracked deletions untouched.
      const candidate = chooseEntrypoint(root, warnings, layout);
      const selected = candidate.kind === 'block' ? { path: layout.rule, kind: 'file' } : candidate;
      state.entrypoint = selected.path;
      if (selected.kind === 'file') {
        requireUntracked(root, selected.path);
        if (exists(root, selected.path, { writable: true })) throw new Error(`Integration namespace collision; existing file preserved: ${selected.path}`);
        const content = Buffer.from(desiredFile(selected.path, vaultName, layout));
        planned.push({ path: selected.path, content, before: null });
        state.entries.push({ path: selected.path, kind: 'file', sha256: sha256(content) });
        repairs.push(selected.path);
      }
      warnings.push(`The missing unowned instruction entrypoint was replaced with a safe reference in ${selected.path}; previous user text was not reconstructed.`);
    }
  }
  // Preflight all destinations before even the narrow ignore-file mutation.
  for (const operation of planned) requireUntracked(root, operation.path);
  if (ensureIgnore(root, vaultName)) changes.push('.gitignore');
  const recreatesRoot = planned.some(operation => operation.path === 'CLAUDE.md' && operation.before === null);
  if ((recreatesRoot || state.entries.some(entry => entry.path === 'CLAUDE.md' && entry.kind === 'file')) && appendRootIgnore(root)) changes.push('.gitignore');
  for (const operation of planned) {
    requireUntracked(root, operation.path);
    const actual = currentBytes(root, operation.path);
    if (operation.before ? !actual?.equals(operation.before) : actual !== null) throw new Error(`Integration destination changed during setup: ${operation.path}`);
    if (operation.content === null) removeOwnedFile(root, operation.path);
    else writeAtomic(root, operation.path, operation.content);
    changes.push(operation.path);
  }
  requireUntracked(root, layout.manifest);
  const nextManifest = json(state);
  if (!exists(root, layout.manifest) || readBytes(root, layout.manifest).toString('utf8') !== nextManifest) { writeAtomic(root, layout.manifest, nextManifest); changes.push(layout.manifest); }
  const status = integrationStatus(root);
  return { ...status, changes: [...new Set(changes)], repairs, warnings: [...new Set([...warnings, ...status.warnings])] };
}

export function removeIntegration(rootInput) {
  const root = rootForSetup(rootInput);
  const layout = selectLayout(root);
  const state = loadManifest(root, layout);
  if (!state) return { installed: false, removed: [], preserved: [], warnings: [] };
  requireUntracked(root, layout.manifest);
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
  requireUntracked(root, layout.manifest);
  if (remaining.length) writeAtomic(root, layout.manifest, json({ ...state, removed: true, entries: remaining }));
  else { removeOwnedFile(root, layout.manifest); removed.push(layout.manifest); }
  const warnings = preserved.length ? ['User-edited integration content and its ownership record were retained. Automatic maintenance is disabled; ignore rules and directories are always preserved.'] : [];
  if (removed.includes(layout.instructions) && !state.entries.some(entry => entry.path === state.entrypoint) && hasInstructionImport(root, state.entrypoint, layout)) warnings.push(`Existing unowned instruction reference remains in ${state.entrypoint}, but its EDW Doc target was removed. Review that reference manually; uninstall did not edit it.`);
  return { installed: false, removed, preserved, warnings };
}
