---
name: standards
description: Catalog repository coding and process standards, assess applicable files, and link results to their evidence.
context: fork
agent: edw-doc:standards
background: false
allowed-tools: mcp__plugin_edw-doc_vault__vault_begin, mcp__plugin_edw-doc_vault__vault_status, mcp__plugin_edw-doc_vault__vault_list, mcp__plugin_edw-doc_vault__vault_read, mcp__plugin_edw-doc_vault__vault_search, mcp__plugin_edw-doc_vault__vault_context, mcp__plugin_edw-doc_vault__vault_packet, mcp__plugin_edw-doc_vault__vault_note, mcp__plugin_edw-doc_vault__vault_standards, mcp__plugin_edw-doc_vault__vault_rule, mcp__plugin_edw-doc_vault__vault_assess, mcp__plugin_edw-doc_vault__vault_end
---

First call `mcp__plugin_edw-doc_vault__vault_begin` with `command: "standards"` and `session_id: "${CLAUDE_SESSION_ID}"`. This is the single native approval for this invocation. If denied or unavailable, stop without retrying or using other tools. Pass the returned `run_id` unchanged to every later broker call, across all batches. Before your final response, call `mcp__plugin_edw-doc_vault__vault_end` with that ID, including when work is incomplete or fails. Do not reuse an ID from an earlier invocation.

Assess standards for the broker's configured repository, optionally narrowed by the user's requested paths or technologies.

1. Read `policies/core.md`, `workflows/standards.md`, and `packs/standards.md` through `mcp__plugin_edw-doc_vault__vault_context`.
2. Check `vault_status`. A current initialized snapshot is required; report a missing build/sync prerequisite rather than attempting unrestricted setup.
3. Follow the standards workflow: inspect applicable rules, cite repository requirements or conventions, and assess current file/rule revisions.
4. Report coverage, evidence-backed results, uncertainty, and any remaining work. The broker generates standards pages and both directions of wiki links.

This is static source assessment. Do not execute linters, tests, transformations, migrations, pipelines, or remote checks. A later `/edw-doc:review` invocation can challenge the recorded explanations and evidence in a separate context.
