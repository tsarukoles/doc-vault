---
name: ask
description: Answer questions about a repository using its Doc Vault and current source evidence.
context: fork
agent: doc-vault:curator
background: false
allowed-tools: mcp__plugin_doc-vault_vault__vault_begin, mcp__plugin_doc-vault_vault__vault_status, mcp__plugin_doc-vault_vault__vault_list, mcp__plugin_doc-vault_vault__vault_read, mcp__plugin_doc-vault_vault__vault_search, mcp__plugin_doc-vault_vault__vault_context, mcp__plugin_doc-vault_vault__vault_packet, mcp__plugin_doc-vault_vault__vault_note, mcp__plugin_doc-vault_vault__vault_standards, mcp__plugin_doc-vault_vault__vault_end
---

First call `mcp__plugin_doc-vault_vault__vault_begin` with `command: "ask"` and `session_id: "${CLAUDE_SESSION_ID}"`. This is the single native approval for this invocation. If denied or unavailable, stop without retrying or using other tools. Pass the returned `run_id` unchanged to every later broker call, across all batches. Before your final response, call `mcp__plugin_doc-vault_vault__vault_end` with that ID, including when work is incomplete or fails. Do not reuse an ID from an earlier invocation.

Read `policies/core.md` and `workflows/ask.md` through `mcp__plugin_doc-vault_vault__vault_context`. Use `vault_status`, `vault_list`, `vault_note`, `vault_search`, `vault_packet`, and `vault_read` to answer the question.

Answer with specific source paths and line references. Verify important generated claims against source; label inferred relationships. If the index is missing or stale, explain that condition rather than silently initializing or refreshing it during a read-only question. This command is read-only. If a saved guide is requested, explain that /doc-vault:onboard has the required write scope. No source evidence means the answer must remain an unresolved question or a clearly labeled general suggestion.
