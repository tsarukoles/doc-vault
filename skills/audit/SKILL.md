---
name: audit
description: Assess repository structure, recurring practices, potential redundancy, and documentation gaps using source evidence.
context: fork
agent: doc-vault:curator
background: false
allowed-tools: mcp__plugin_doc-vault_vault__vault_begin, mcp__plugin_doc-vault_vault__vault_status, mcp__plugin_doc-vault_vault__vault_list, mcp__plugin_doc-vault_vault__vault_read, mcp__plugin_doc-vault_vault__vault_search, mcp__plugin_doc-vault_vault__vault_context, mcp__plugin_doc-vault_vault__vault_packet, mcp__plugin_doc-vault_vault__vault_note, mcp__plugin_doc-vault_vault__vault_standards, mcp__plugin_doc-vault_vault__vault_scan, mcp__plugin_doc-vault_vault__vault_publish, mcp__plugin_doc-vault_vault__vault_lint, mcp__plugin_doc-vault_vault__vault_refresh, mcp__plugin_doc-vault_vault__vault_end
---

First call `mcp__plugin_doc-vault_vault__vault_begin` with `command: "audit"` and `session_id: "${CLAUDE_SESSION_ID}"`. This is the single native approval for this invocation. If denied or unavailable, stop without retrying or using other tools. Pass the returned `run_id` unchanged to every later broker call, across all batches. Before your final response, call `mcp__plugin_doc-vault_vault__vault_end` with that ID, including when work is incomplete or fails. Do not reuse an ID from an earlier invocation.

Read `policies/core.md`, `workflows/audit.md`, and `packs/standards.md` through `mcp__plugin_doc-vault_vault__vault_context`. Inspect current status before analyzing sources.

Audit the requested scope. Publish advisory findings with concrete evidence, impact, an actionable improvement, and uncertainty. Distinguish supplied requirements from observed conventions. Do not claim a compliance certification, dead-code proof, runtime verification, or a code fix. Use `vault_lint` to check published notes. Evidence review of an existing note belongs to the separate `/doc-vault:review` skill.
