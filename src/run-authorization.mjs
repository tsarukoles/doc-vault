import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { checkedPath, makeDirectory, readBytes, rootDirectory, sha256, writeAtomic } from './security.mjs';

export const READ_TOOLS = Object.freeze(['vault_status', 'vault_list', 'vault_read', 'vault_search', 'vault_context', 'vault_packet', 'vault_note', 'vault_standards']);
const curator = [...READ_TOOLS, 'vault_scan', 'vault_publish', 'vault_lint', 'vault_refresh'];
export const COMMAND_TOOLS = Object.freeze(Object.fromEntries(Object.entries({
  build: curator, sync: curator, audit: curator, onboard: curator,
  ask: READ_TOOLS, status: READ_TOOLS,
  review: [...READ_TOOLS, 'vault_review'],
  standards: [...READ_TOOLS, 'vault_rule', 'vault_assess'],
}).map(([name, tools]) => [name, Object.freeze([...tools])])));

// Ephemeral host lifecycle markers contain no repository content or approval
// tokens. They allow hook processes to revoke grants in the long-lived broker.
const DIRECTORY = `doc-vault-run-lifecycle-v1-${sha256(os.homedir()).slice(0,16)}`;
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_IDLE_MS = 4 * 60 * 60 * 1000;
const invalidatingEvents = new Set(['SessionStart', 'UserPromptSubmit', 'Stop', 'SessionEnd', 'SubagentStop']);
function location(root, sessionId) {
  if (!ID.test(sessionId || '')) throw new Error('A host-provided session_id is required; reload the plugin in Claude Code.');
  const parent = rootDirectory(os.tmpdir());
  return { parent, relative: `${DIRECTORY}/${sha256(rootDirectory(root) + '\0' + sessionId)}.json` };
}

export function invalidateRuns(root, event) {
  if (!invalidatingEvents.has(event.hook_event_name) || !event.session_id) return;
  if (event.hook_event_name === 'SessionStart' && event.source === 'compact') return;
  if (event.hook_event_name === 'SubagentStop' && !/^doc-vault:(curator|standards|reviewer)$/.test(event.agent_type || '')) return;
  const { parent, relative } = location(root, event.session_id);
  makeDirectory(parent, DIRECTORY);
  writeAtomic(parent, relative, JSON.stringify({ generation: crypto.randomBytes(24).toString('hex'), event: event.hook_event_name }) + '\n');
}

function generation(root, sessionId) {
  const { parent, relative } = location(root, sessionId);
  if (!fs.existsSync(checkedPath(parent, relative, { allowMissing: true }))) {
    throw new Error('Doc Vault lifecycle hooks are not active for this session. Reload the plugin and invoke the command again; no run was authorized.');
  }
  const record = JSON.parse(readBytes(parent, relative, 2048));
  if (!/^[a-f0-9]{48}$/.test(record.generation) || !invalidatingEvents.has(record.event)) throw new Error('Invalid Doc Vault lifecycle marker.');
  if (['Stop', 'SubagentStop', 'SessionEnd'].includes(record.event)) throw new Error('The previous invocation has ended. Invoke the Doc Vault command again.');
  return record.generation;
}

export function supportsRunApproval(client) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(client?.version || '');
  if (client?.name !== 'claude-code' || !match) return false;
  const [major, minor, patch] = match.slice(1).map(Number);
  return major > 2 || (major === 2 && (minor > 1 || (minor === 1 && patch >= 199)));
}

export function createRunAuthorization(root, { now = Date.now } = {}) {
  root = rootDirectory(root);
  const grants = new Map();
  function current(runId) {
    const grant = grants.get(runId);
    if (!grant) throw new Error('No active approval for this run. Invoke the Doc Vault command and approve vault_begin first.');
    try {
      if (now() - grant.lastUsed >= MAX_IDLE_MS || generation(root, grant.sessionId) !== grant.generation) throw new Error('Run approval expired or the invocation ended.');
    } catch (error) { grants.delete(runId); throw error; }
    return grant;
  }
  return {
    begin({ command, session_id: sessionId }, client) {
      // The host enforces requiresUserInteraction before dispatching this call.
      // Unknown/older clients must not silently ignore that metadata.
      if (!supportsRunApproval(client)) throw new Error('Single-run approval requires Claude Code CLI 2.1.199 or later with explicit-approval support.');
      if (!Object.hasOwn(COMMAND_TOOLS, command)) throw new Error('Unknown Doc Vault command.');
      const epoch = generation(root, sessionId);
      for (const [id, grant] of grants) if (grant.sessionId === sessionId || now() - grant.lastUsed >= MAX_IDLE_MS) grants.delete(id);
      if (grants.size >= 32) throw new Error('Too many active Doc Vault sessions. End unused runs first.');
      const runId = crypto.randomBytes(32).toString('hex');
      grants.set(runId, { command, sessionId, generation: epoch, lastUsed: now() });
      return { run_id: runId, command, repository: root, tools: COMMAND_TOOLS[command], authorization: 'Use this run_id for all batches in this invocation. Call vault_end before returning.' };
    },
    check(runId, tool) {
      const grant = current(runId);
      if (!COMMAND_TOOLS[grant.command].includes(tool)) throw new Error(`Tool ${tool} is outside the approved ${grant.command} command.`);
      grant.lastUsed = now();
    },
    end(runId) {
      if (!grants.delete(runId)) throw new Error('This run is already closed or unknown.');
      return { ended: true };
    },
    cancel() { grants.clear(); },
  };
}
