---
name: sync
description: Refresh a local EDW Doc after source changes and update affected explanations and references.
context: fork
agent: edw-doc:curator
background: false
allowed-tools: mcp__plugin_edw-doc_vault__vault_begin, mcp__plugin_edw-doc_vault__vault_status, mcp__plugin_edw-doc_vault__vault_list, mcp__plugin_edw-doc_vault__vault_read, mcp__plugin_edw-doc_vault__vault_search, mcp__plugin_edw-doc_vault__vault_context, mcp__plugin_edw-doc_vault__vault_packet, mcp__plugin_edw-doc_vault__vault_note, mcp__plugin_edw-doc_vault__vault_standards, mcp__plugin_edw-doc_vault__vault_scan, mcp__plugin_edw-doc_vault__vault_publish, mcp__plugin_edw-doc_vault__vault_lint, mcp__plugin_edw-doc_vault__vault_refresh, mcp__plugin_edw-doc_vault__vault_end
---

First call `mcp__plugin_edw-doc_vault__vault_begin` with `command: "sync"` and `session_id: "${CLAUDE_SESSION_ID}"`. This is the single native approval for this invocation. If denied or unavailable, stop without retrying or using other tools. Pass the returned `run_id` unchanged to every later broker call, across all batches. Before your final response, call `mcp__plugin_edw-doc_vault__vault_end` with that ID, including when work is incomplete or fails. Do not reuse an ID from an earlier invocation.

Read `policies/core.md` and `workflows/sync.md` through `mcp__plugin_edw-doc_vault__vault_context`. Use `vault_status` followed by `vault_refresh`, then inspect the resulting changes and stale notes.

Re-analyze affected source evidence and relationships before publishing replacements. Keep unrelated content intact through the broker's managed publication model. Run `vault_lint` and distinguish refreshed static maps from refreshed model explanations. Do not install Git hooks, change Git configuration, execute tests, or claim remote synchronization.
