#!/usr/bin/env node
import fs from 'node:fs';
import { gitRead } from '../src/inventory.mjs';
import { invalidateRuns } from '../src/run-authorization.mjs';
import { configurationEnvironment } from '../src/identity.mjs';

// Revocation only. No source/vault writes, model calls, or blocking hook output.
try {
  const input = fs.readFileSync(0, 'utf8');
  if (input.length > 1024 * 1024) throw new Error('Hook input too large.');
  const event = input.trim() ? JSON.parse(input) : {};
  const configuration = configurationEnvironment();
  const initial = configuration.root || event.cwd || process.cwd();
  const root = configuration.root || gitRead(initial, ['rev-parse', '--show-toplevel'])?.trim() || initial;
  invalidateRuns(root, event);
} catch (error) {
  process.stderr.write(`EDW Doc approval lifecycle unavailable: ${error.message}\n`);
}
