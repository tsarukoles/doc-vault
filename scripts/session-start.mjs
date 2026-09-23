#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createEngine } from '../src/engine.mjs';
import { gitRead } from '../src/inventory.mjs';

// Read-only lifecycle hint. It never creates a vault or installs native hooks.
try {
  const input=fs.readFileSync(0,'utf8');
  if(input.length>1024*1024)throw new Error('Hook input too large.');
  const event=input.trim()?JSON.parse(input):{};
  const initial=process.env.DOC_VAULT_ROOT || event.cwd || process.cwd();
  const root=process.env.DOC_VAULT_ROOT ? initial : gitRead(initial,['rev-parse','--show-toplevel'])?.trim() || initial;
  const vaultName=process.env.DOC_VAULT_NAME || 'doc-vault';
  if(fs.existsSync(path.join(root,vaultName))) {
    const engine=await createEngine(root,{vaultName});
    const status=await engine.status();
    const message=status.initialized?(status.fresh?'Doc Vault source inventory is current. Agent explanations may still require independent review.':'Doc Vault has changed inputs or an incomplete update. Use /doc-vault:sync before relying on generated explanations.'):'Doc Vault is not initialized.';
    const backlog=status.pending_analysis?` ${status.pending_analysis} previous explanations need fresh analysis; run /doc-vault:sync.`:'';
    process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'SessionStart',additionalContext:message+backlog}})+'\n');
  }
} catch(error) {
  // Missing runtimes, invalid state, or inaccessible workspaces must not prevent
  // the user's ordinary agent session from opening.
  process.stderr.write(`Doc Vault freshness check unavailable: ${error.message}\n`);
}
