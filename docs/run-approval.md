# Approval for an EDW Doc command

Version 0.2.0 retains the one explicit approval per invocation introduced in 0.1.3, now under the `/edw-doc:*` command names. The command begins with `vault_begin`, reuses the returned `run_id` for all its broker operations and batches, and calls `vault_end` before returning. Declining the initial approval ends the command; the agent must not retry the prompt or switch to other tools.

The approval identifies the configured repository and the requested command. Source files remain read-only. The existing broker controls managed output paths, evidence, annotations, and the narrow root `.gitignore` additions. It does not grant shell execution, arbitrary writes, source edits, Git mutations, or external publication. The host's configured model still processes selected source evidence.

## Required host

Use Claude Code CLI **2.1.199 or later**, with this plugin's hooks and MCP server loaded. `vault_begin` advertises `_meta["anthropic/requiresUserInteraction"]: true`; that host feature requires explicit approval even if an allow rule matches the tool. The broker refuses approval from older or unrecognized clients rather than silently relying on metadata they may ignore. Its supported MCP client identity is `claude-code` with a semantic CLI version at or above the minimum.

Each skill declares exact `allowed-tools`, matching its command scope. These grants suppress normal per-operation prompts for that invocation; they do not grant unrestricted permissions or change user/project settings. Existing ask/deny rules, organizational policy, initial workspace/server trust, or other hooks can still add prompts or refuse access. Plugin subagents ignore `permissionMode`, so setting it there is not a solution.

Skill tool grants clear on a new user message. Invoking the command again grants its specific tools for that turn and starts a new approval. Normal tool batches and context compaction within the same invocation retain the existing run ID. A new invocation or restarted broker requires new approval; no authorization token is saved in the vault.

## Enforced scopes

| Command | Broker capabilities after approval |
|---|---|
| `build`, `sync`, `audit`, `onboard` | Repository/context reads, inventory/refresh, managed draft publication and mechanical checks. |
| `standards` | Repository/context reads plus evidenced rule registration and assessments; no scan or general publication. |
| `review` | Repository/context reads plus exact-revision review records; no corrected-note publication. |
| `ask`, `status` | Read operations only. Use `onboard` when a saved guide is wanted. |

Every existing MCP operation requires `run_id`. The broker checks it and its command scope before dispatching to the engine. The root is fixed when the broker starts. Host tool lists still restrict each agent's available tools. A run token is scoped to the approved command, not proof of an agent's identity: a caller possessing it has that command's broker capabilities. It must not be written into notes or passed to unrelated agents.

## Ending and interruption

`vault_end` closes the run. A new approval replaces an older grant for the same session. New user prompts, session starts/resumes, session ends, and completion of the EDW Doc curator, standards, or reviewer agent revoke old grants through lifecycle markers. Compaction, read-only worker completion, and unrelated subagent completion do not revoke them. MCP cancellation notifications also revoke grants. The next user prompt closes any remaining grant after an interruption that emitted no cancellation notification. Broker restart loses all grants. Four hours without an authorized operation expires an abandoned grant; there is no step, token, or total-runtime cap on an active grant.

Lifecycle hooks write only small random-generation markers in the current user's temporary directory, keyed by hashes of the repository and host session ID. They contain no source content or approval tokens. This is ephemeral plugin bookkeeping, separate from repository output. Missing or unreadable markers prevent a new run or further broker operations; hook errors themselves never block development. These are checks inside a trusted host process, not OS isolation from another process running as the same user.

The finish maintenance hook now reports a reminder instead of returning `decision: "block"`. Existing setup-enabled static reconciliation remains separate from an AI sweep; there is no automatic model run or global permission change.

## Update and verify

Follow the [rename upgrade instructions](installation.md#upgrade-from-the-old-plugin-name) when moving from `doc-vault` to `edw-doc`, then start a new Claude Code session. For a development checkout, load it with `claude --plugin-dir /absolute/path/to/edw-doc-plugin`. Existing locally installed instructions can be updated by re-running the documented setup command; unchanged owned files are updated, and user edits are preserved. Retained `.claude/doc-vault/` integration paths do not require manual renaming.

In a small test repository, verify:

1. Invoke `/edw-doc:build`. Approve `vault_begin` once; inspect that its prompt names the intended root and command.
2. Confirm ordinary context reads, source reads, scan, and publication do not prompt again. They must all include the same `run_id`.
3. Repeat with `standards` and `sync`, including enough work to cross several batches or a compaction. Each new command gets one new approval.
4. Decline the approval. No broker read or write from that invocation should execute and the command should finish without another attempt.
5. Cancel a run, send a new prompt, and verify the previous token is rejected. Verify normal completion calls `vault_end` and subsequent use is rejected.
6. Confirm `ask`/`status` cannot scan or publish, and `standards` cannot publish general notes. Source bytes and user annotations must remain intact.
7. End an ordinary coding task while documentation is outdated. Its finish must not be blocked by EDW Doc.

Protocol and local boundary tests simulate dispatch after approval; they cannot prove that a real CLI displayed the prompt or inherited skill grants in a forked agent. Count actual prompts in the intended Claude CLI/provider environment before claiming the one-prompt experience is verified. Claude CLI was unavailable in the implementation environment.

Official references: [skill tool grants](https://code.claude.com/docs/en/skills#pre-approve-tools-for-a-skill), [mandatory MCP approval](https://code.claude.com/docs/en/mcp#require-approval-for-a-specific-tool), [plugin subagent limitations](https://code.claude.com/docs/en/sub-agents), and [hook lifecycle](https://code.claude.com/docs/en/hooks).
