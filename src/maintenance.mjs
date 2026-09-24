import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { createEngine } from './engine.mjs';
import { integrationStatus } from './integration.mjs';
import { assertUntrackedVault } from './inventory.mjs';
import { notePath } from './render.mjs';
import { checkedPath, readBytes, rootDirectory, writeAtomic, removeOwnedFile } from './security.mjs';

const RECEIPT = '.system/maintenance.json';
const LOCK = '.system/maintenance-lock.json';
const EVENTS = new Set(['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'Stop']);

function receipt(vault) {
  if (!fs.existsSync(checkedPath(vault, RECEIPT, { allowMissing: true, write: true }))) return {};
  const value = JSON.parse(readBytes(vault, RECEIPT, 16384).toString('utf8'));
  if (value.product !== 'doc-vault-maintenance' || value.version !== 1) throw new Error('Unrecognized maintenance state; preserved for inspection.');
  for (const key of ['snapshot', 'notified_snapshot']) {
    if (value[key] !== null && value[key] !== undefined && !/^s_[a-f0-9]{20}$/.test(value[key])) throw new Error('Invalid maintenance snapshot.');
  }
  return value;
}

// Reconciliation runs only at host checkpoints. It does not execute source code,
// start a model, install a watcher, or initialize a previously absent vault.
export async function maintain(rootInput, event = {}, { vaultName } = {}) {
  const name = event.hook_event_name;
  if (!EVENTS.has(name) || event.permission_mode === 'plan' || event.agent_id) return { skipped: true };
  if (name === 'PostToolUse' && /^mcp__plugin_doc-vault_vault__/.test(event.tool_name || '')) return { skipped: true };
  const root = rootDirectory(rootInput);
  const setup = integrationStatus(root);
  if (!setup.installed || !setup.maintenanceEnabled) return { skipped: true };
  if (vaultName && vaultName !== setup.vaultName) throw new Error('Hook vault configuration differs from local setup. Align the configuration before maintenance.');
  vaultName = setup.vaultName;
  const vault = checkedPath(root, vaultName, { allowMissing: true, write: true });
  if (!fs.existsSync(vault)) return { skipped: true, reason: 'Build the vault first.' };
  const owner = JSON.parse(readBytes(vault, '.system/owner.json', 8192).toString('utf8'));
  if (owner.product !== 'doc-vault') throw new Error('Maintenance requires an owned vault.');
  assertUntrackedVault(root, vaultName);
  const lock = checkedPath(vault, LOCK, { allowMissing: true, write: true });
  if (fs.existsSync(lock)) {
    const held = JSON.parse(readBytes(vault, LOCK, 8192).toString('utf8'));
    if (held.product !== 'doc-vault-maintenance' || held.host !== os.hostname() || !Number.isInteger(held.pid) || held.pid <= 0) return { skipped: true, busy: true };
    try { process.kill(held.pid, 0); return { skipped: true, busy: true }; }
    catch (error) { if (error.code !== 'ESRCH') return { skipped: true, busy: true }; }
    removeOwnedFile(vault, LOCK);
  }
  const token = crypto.randomBytes(16).toString('hex');
  try { fs.writeFileSync(lock, JSON.stringify({ product: 'doc-vault-maintenance', host: os.hostname(), pid: process.pid, token }), { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code === 'EEXIST') return { skipped: true, busy: true }; throw error; }
  try {
    const previous = receipt(vault);
    // Avoid hashing on every tool call; Stop and the next prompt always reconcile.
    if (name === 'PostToolUse' && Number.isFinite(previous.checked_at_ms) && Date.now() >= previous.checked_at_ms && Date.now() - previous.checked_at_ms < 2000) return { skipped: true, throttled: true };
    const engine = await createEngine(root, { vaultName });
    const before = await engine.status();
    if (!before.initialized) return { skipped: true };
    const refreshed = await engine.refresh();
    const snapshot = refreshed.snapshot.id;
    const changed = !refreshed.unchanged;
    const invalidated = refreshed.invalidated_note_paths.length;
    // Include new file notes even when another watcher already refreshed the
    // snapshot. A static note is useful, but is not completed model analysis.
    const inventory = JSON.parse(readBytes(vault, '.system/state.json', 64 * 1024 * 1024).toString('utf8'));
    const pendingFiles = inventory.records.filter(record => record.status === 'included' && !inventory.enrichments[notePath(record.path)]).length;
    const pending = invalidated > 0 || pendingFiles > 0;
    const state = { product: 'doc-vault-maintenance', version: 1, snapshot, pending,
      notified_snapshot: previous.notified_snapshot || null, checked_at_ms: Date.now() };
    let notifySync = false;
    if (name === 'Stop' && !event.stop_hook_active && pending && state.notified_snapshot !== snapshot) {
      notifySync = true;
      // Persist before the reminder so repeated stop events do not nag the developer.
      state.notified_snapshot = snapshot;
    }
    // A reminder is not a completion marker. Recompute coverage from the actual
    // broker state at the next event, rather than trusting the agent's response.
    writeAtomic(vault, RECEIPT, JSON.stringify(state, null, 2) + '\n');
    return { refreshed: changed, pending, pendingFiles, invalidated, snapshot, notifySync, vaultName,
      message: pending
        ? 'Doc Vault has pending documentation work. When convenient, run /doc-vault:sync in Claude Code. Do not interrupt ordinary coding or start a sweep automatically.'
        : 'Doc Vault source inventory is current. Static freshness does not establish completed AI analysis or independent review.' };

  } finally {
    if (fs.existsSync(checkedPath(vault, LOCK, { allowMissing: true, write: true }))) {
      const held = JSON.parse(readBytes(vault, LOCK, 8192).toString('utf8'));
      if (held.token === token) removeOwnedFile(vault, LOCK);
    }
  }
}
