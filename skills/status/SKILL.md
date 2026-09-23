---
name: status
description: Report Doc Vault initialization, source freshness, analysis coverage, and review state without changing files.
context: fork
agent: doc-vault:curator
background: false
---

Read `policies/core.md` and `workflows/status.md` through `mcp__plugin_doc-vault_vault__vault_context`. Call `vault_status` and, when needed, use read-only inventory or note tools to understand its result.

Summarize initialization, indexed source state, reported changes, static coverage, enrichment coverage, and review state. Report fields unavailable from the broker as unknown. Do not call scan, refresh, publish, review, or any tool that writes. Do not call lint if its implementation writes a report. A clean status is evidence of indexed freshness, not semantic completeness or successful runtime behavior.
