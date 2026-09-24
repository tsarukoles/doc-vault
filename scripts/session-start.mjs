#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createEngine } from '../src/engine.mjs';
import { gitRead } from '../src/inventory.mjs';
import { maintain } from '../src/maintenance.mjs';
import { integrationStatus } from '../src/integration.mjs';
import { configurationEnvironment } from '../src/identity.mjs';

// Read-only unless separate local setup enabled maintenance of an existing vault.
try {
  const input=fs.readFileSync(0,'utf8');
  if(input.length>1024*1024)throw new Error('Hook input too large.');
  const event=input.trim()?JSON.parse(input):{};
  const configuration=configurationEnvironment();
  const initial=configuration.root || event.cwd || process.cwd();
  const root=configuration.root ? initial : gitRead(initial,['rev-parse','--show-toplevel'])?.trim() || initial;
  const setup=integrationStatus(root);
  const vaultName=configuration.vaultName || (setup.installed ? setup.vaultName : 'edw-doc');
  const maintenance=await maintain(root,{...event,hook_event_name:'SessionStart'},{vaultName:configuration.vaultName});
  if(!maintenance.skipped) {
    process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'SessionStart',additionalContext:maintenance.message}})+'\n');
  } else
  if(fs.existsSync(path.join(root,vaultName))) {
    const engine=await createEngine(root,{vaultName});
    const status=await engine.status();
    const message=status.initialized?(status.fresh?'EDW Doc source inventory is current. Agent explanations may still require independent review.':'EDW Doc has changed inputs or an incomplete update. Use /edw-doc:sync before relying on generated explanations.'):'EDW Doc is not initialized.';
    const backlog=status.pending_analysis?` ${status.pending_analysis} previous explanations need fresh analysis; run /edw-doc:sync.`:'';
    process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'SessionStart',additionalContext:message+backlog}})+'\n');
  } else if(!configuration.vaultName&&fs.existsSync(path.join(root,'doc-vault','.system','owner.json'))) {
    process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'SessionStart',additionalContext:'A legacy doc-vault folder is present. The default vault folder is now edw-doc. Use the explicit CLI migrate command with --root <repository> --from doc-vault --to edw-doc, or set EDW_DOC_NAME=doc-vault to continue using the existing folder. No files were changed.'}})+'\n');
  }
} catch(error) {
  // Missing runtimes, invalid state, or inaccessible workspaces must not prevent
  // the user's ordinary agent session from opening.
  process.stderr.write(`EDW Doc freshness check unavailable: ${error.message}\n`);
}
