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
      output = result.requestSync
        ? { decision: 'block', reason: 'Doc Vault maintenance: run /doc-vault:sync once for this changed source snapshot using the installed broker tools. Include new files and affected flows/onboarding. If unavailable, interrupted, or unable to finish, report the remaining work and finish; do not retry or widen permissions. Standards assessment and independent review remain separate.' }
        : result.pending ? { systemMessage: 'Doc Vault may still have incomplete AI analysis. No further automatic continuation will be requested for this snapshot; inspect /doc-vault:status and run /doc-vault:sync manually if needed.' } : null;
    } else if (result.pending) {
      output = { hookSpecificOutput: { hookEventName: event.hook_event_name, additionalContext: result.message } };
    }
    if (output) process.stdout.write(JSON.stringify(output) + '\n');
  }
} catch (error) {
  // An optional documentation integration must not stop ordinary coding or Git.
  process.stderr.write(`Doc Vault maintenance deferred: ${error.message}\n`);
}
