#!/usr/bin/env node
import fs from 'node:fs';
import { gitRead } from '../src/inventory.mjs';
import { invalidateRuns } from '../src/run-authorization.mjs';

// Revocation only. No source/vault writes, model calls, or blocking hook output.
try {
  const input = fs.readFileSync(0, 'utf8');
  if (input.length > 1024 * 1024) throw new Error('Hook input too large.');
  const event = input.trim() ? JSON.parse(input) : {};
  const initial = process.env.DOC_VAULT_ROOT || event.cwd || process.cwd();
  const root = process.env.DOC_VAULT_ROOT || gitRead(initial, ['rev-parse', '--show-toplevel'])?.trim() || initial;
  invalidateRuns(root, event);
} catch (error) {
  process.stderr.write(`Doc Vault approval lifecycle unavailable: ${error.message}\n`);
}
