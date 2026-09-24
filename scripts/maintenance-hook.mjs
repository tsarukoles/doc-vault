#!/usr/bin/env node
import fs from 'node:fs';
import { gitRead } from '../src/inventory.mjs';
import { maintain } from '../src/maintenance.mjs';
import { configurationEnvironment } from '../src/identity.mjs';

try {
  const input = fs.readFileSync(0, 'utf8');
  if (input.length > 1024 * 1024) throw new Error('Hook input too large.');
  const event = input.trim() ? JSON.parse(input) : {};
  const configuration = configurationEnvironment();
  const initial = configuration.root || event.cwd || process.cwd();
  const root = configuration.root ? initial : gitRead(initial, ['rev-parse', '--show-toplevel'])?.trim() || initial;
  const result = await maintain(root, event, { vaultName: configuration.vaultName });
  if (!result.skipped) {
    let output;
    if (event.hook_event_name === 'Stop') {
      output = result.notifySync
        ? { systemMessage: 'Don’t forget to sync EDW Doc. In Claude Code, run /edw-doc:sync when convenient. Documentation maintenance must not interrupt your development work.' }
        : null;
    } else if (result.pending) {
      output = { hookSpecificOutput: { hookEventName: event.hook_event_name, additionalContext: result.message } };
    }
    if (output) process.stdout.write(JSON.stringify(output) + '\n');
  }
} catch (error) {
  // An optional documentation integration must not stop ordinary coding or Git.
  process.stderr.write(`EDW Doc maintenance deferred: ${error.message}\n`);
}
