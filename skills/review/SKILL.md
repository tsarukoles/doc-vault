---
name: review
description: Independently check published EDW Doc explanations against current source evidence and record qualified review verdicts.
context: fork
agent: edw-doc:reviewer
background: false
allowed-tools: mcp__plugin_edw-doc_vault__vault_begin, mcp__plugin_edw-doc_vault__vault_status, mcp__plugin_edw-doc_vault__vault_list, mcp__plugin_edw-doc_vault__vault_read, mcp__plugin_edw-doc_vault__vault_search, mcp__plugin_edw-doc_vault__vault_context, mcp__plugin_edw-doc_vault__vault_packet, mcp__plugin_edw-doc_vault__vault_note, mcp__plugin_edw-doc_vault__vault_standards, mcp__plugin_edw-doc_vault__vault_review, mcp__plugin_edw-doc_vault__vault_end
---

First call `mcp__plugin_edw-doc_vault__vault_begin` with `command: "review"` and `session_id: "${CLAUDE_SESSION_ID}"`. This is the single native approval for this invocation. If denied or unavailable, stop without retrying or using other tools. Pass the returned `run_id` unchanged to every later broker call, across all batches. Before your final response, call `mcp__plugin_edw-doc_vault__vault_end` with that ID, including when work is incomplete or fails. Do not reuse an ID from an earlier invocation.

Read `policies/core.md` and `workflows/review.md` through `mcp__plugin_edw-doc_vault__vault_context`. Review the requested notes, or a clearly declared bounded sample when no scope is supplied.

Read each note using `vault_note`; inspect original source evidence; then call `vault_review` with the exact `expected_note_sha256` returned by `vault_note`, current source locators, a verdict, and a precise reason. Do not rewrite notes. Report the checked scope and remaining gaps. A supported verdict means an agent checked those claims against available evidence, not that a person approved them or that the implementation ran successfully.
