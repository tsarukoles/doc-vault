---
name: status
description: Report EDW Doc initialization, source freshness, analysis coverage, and review state without changing files.
context: fork
agent: edw-doc:curator
background: false
allowed-tools: mcp__plugin_edw-doc_vault__vault_begin, mcp__plugin_edw-doc_vault__vault_status, mcp__plugin_edw-doc_vault__vault_list, mcp__plugin_edw-doc_vault__vault_read, mcp__plugin_edw-doc_vault__vault_search, mcp__plugin_edw-doc_vault__vault_context, mcp__plugin_edw-doc_vault__vault_packet, mcp__plugin_edw-doc_vault__vault_note, mcp__plugin_edw-doc_vault__vault_standards, mcp__plugin_edw-doc_vault__vault_end
---

First call `mcp__plugin_edw-doc_vault__vault_begin` with `command: "status"` and `session_id: "${CLAUDE_SESSION_ID}"`. This is the single native approval for this invocation. If denied or unavailable, stop without retrying or using other tools. Pass the returned `run_id` unchanged to every later broker call, across all batches. Before your final response, call `mcp__plugin_edw-doc_vault__vault_end` with that ID, including when work is incomplete or fails. Do not reuse an ID from an earlier invocation.

Read `policies/core.md` and `workflows/status.md` through `mcp__plugin_edw-doc_vault__vault_context`. Call `vault_status` and, when needed, use read-only inventory or note tools to understand its result.

Summarize initialization, indexed source state, changes, static and enrichment coverage, and review state. Also report integration presence, instruction entry point, maintenance state, warnings, and whether activation is verified. Use returned ignore diagnostics to distinguish effective Git exclusion from already tracked output, naming the relevant roots or paths when needed. Report unavailable fields as unknown. Do not call scan, refresh, setup, publish, review, or any writing operation; avoid lint if it writes a report. Fresh inventory does not establish complete analysis, loaded instructions, or successful runtime behavior.
