---
name: review
description: Independently check published Doc Vault explanations against current source evidence and record qualified review verdicts.
context: fork
agent: doc-vault:reviewer
background: false
---

Read `policies/core.md` and `workflows/review.md` through `mcp__plugin_doc-vault_vault__vault_context`. Review the requested notes, or a clearly declared bounded sample when no scope is supplied.

Read each note using `vault_note`; inspect original source evidence; then call `vault_review` with the exact `expected_note_sha256` returned by `vault_note`, current source locators, a verdict, and a precise reason. Do not rewrite notes. Report the checked scope and remaining gaps. A supported verdict means an agent checked those claims against available evidence, not that a person approved them or that the implementation ran successfully.
