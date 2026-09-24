#!/usr/bin/env node
import fs from 'node:fs';
import { gitRead } from '../src/inventory.mjs';
import { maintain } from '../src/maintenance.mjs';

try {
  const input = fs.readFileSync(0, 'utf8');
  if (input.length > 1024 * 1024) throw new Error('Hook input too large.');
  const event = input.trim() ? JSON.parse(input) : {};
  const initial = process.env.DOC_VAULT_ROOT || event.cwd || process.cwd();
  const root = process.env.DOC_VAULT_ROOT ? initial : gitRead(initial, ['rev-parse', '--show-toplevel'])?.trim() || initial;
  const result = await maintain(root, event, { vaultName: process.env.DOC_VAULT_NAME });
  if (!result.skipped) {
    let output;
    if (event.hook_event_name === 'Stop') {
      output = result.notifySync
        ? { systemMessage: 'Don’t forget to sync Doc Vault. In Claude Code, run /doc-vault:sync when convenient. Documentation maintenance must not interrupt your development work.' }
        : null;
    } else if (result.pending) {
      output = { hookSpecificOutput: { hookEventName: event.hook_event_name, additionalContext: result.message } };
    }
    if (output) process.stdout.write(JSON.stringify(output) + '\n');
  }
} catch (error) {
  // An optional documentation integration must not stop ordinary coding or Git.
  process.stderr.write(`Doc Vault maintenance deferred: ${error.message}\n`);
}
