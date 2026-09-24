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

Summarize initialization, indexed source state, reported changes, static coverage, enrichment coverage, and review state. Report fields unavailable from the broker as unknown. Do not call scan, refresh, publish, review, or any tool that writes. Do not call lint if its implementation writes a report. A clean status is evidence of indexed freshness, not semantic completeness or successful runtime behavior.
