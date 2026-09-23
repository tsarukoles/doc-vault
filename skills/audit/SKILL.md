---
name: audit
description: Assess repository structure, recurring practices, potential redundancy, and documentation gaps using source evidence.
context: fork
agent: doc-vault:curator
background: false
---

Read `policies/core.md`, `workflows/audit.md`, and `packs/standards.md` through `mcp__plugin_doc-vault_vault__vault_context`. Inspect current status before analyzing sources.

Audit the requested scope. Publish advisory findings with concrete evidence, impact, an actionable improvement, and uncertainty. Distinguish supplied requirements from observed conventions. Do not claim a compliance certification, dead-code proof, runtime verification, or a code fix. Use `vault_lint` to check published notes. Evidence review of an existing note belongs to the separate `/doc-vault:review` skill.
