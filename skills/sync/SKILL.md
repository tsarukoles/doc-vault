---
name: sync
description: Refresh a local Doc Vault after source changes and update affected explanations and references.
context: fork
agent: doc-vault:curator
background: false
---

Read `policies/core.md` and `workflows/sync.md` through `mcp__plugin_doc-vault_vault__vault_context`. Use `vault_status` followed by `vault_refresh`, then inspect the resulting changes and stale notes.

Re-analyze affected source evidence and relationships before publishing replacements. Keep unrelated content intact through the broker's managed publication model. Run `vault_lint` and distinguish refreshed static maps from refreshed model explanations. Do not install Git hooks, change Git configuration, execute tests, or claim remote synchronization.
