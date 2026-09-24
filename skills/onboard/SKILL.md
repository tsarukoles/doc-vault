---
name: onboard
description: Create a source-grounded onboarding guide explaining a repository's purpose, entry points, and representative flows.
context: fork
agent: edw-doc:curator
background: false
allowed-tools: mcp__plugin_edw-doc_vault__vault_begin, mcp__plugin_edw-doc_vault__vault_status, mcp__plugin_edw-doc_vault__vault_list, mcp__plugin_edw-doc_vault__vault_read, mcp__plugin_edw-doc_vault__vault_search, mcp__plugin_edw-doc_vault__vault_context, mcp__plugin_edw-doc_vault__vault_packet, mcp__plugin_edw-doc_vault__vault_note, mcp__plugin_edw-doc_vault__vault_standards, mcp__plugin_edw-doc_vault__vault_scan, mcp__plugin_edw-doc_vault__vault_publish, mcp__plugin_edw-doc_vault__vault_lint, mcp__plugin_edw-doc_vault__vault_refresh, mcp__plugin_edw-doc_vault__vault_end
---

First call `mcp__plugin_edw-doc_vault__vault_begin` with `command: "onboard"` and `session_id: "${CLAUDE_SESSION_ID}"`. This is the single native approval for this invocation. If denied or unavailable, stop without retrying or using other tools. Pass the returned `run_id` unchanged to every later broker call, across all batches. Before your final response, call `mcp__plugin_edw-doc_vault__vault_end` with that ID, including when work is incomplete or fails. Do not reuse an ID from an earlier invocation.

Read `policies/core.md`, `workflows/onboard.md`, and `templates/onboarding.md` through `mcp__plugin_edw-doc_vault__vault_context`. Use the existing vault when current; inspect supporting source before relying on generated explanations.

Create a concise guide for the user's role and question. Link verified entry points and explain a representative execution path, configuration boundaries, failure locations, and open questions. Publish a draft onboarding note with source evidence. Describe source-declared setup commands as documented instructions only; do not run them or claim they work. Report missing evidence and freshness.
