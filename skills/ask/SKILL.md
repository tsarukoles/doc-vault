---
name: ask
description: Answer questions about a repository using its Doc Vault and current source evidence.
context: fork
agent: doc-vault:curator
background: false
---

Read `policies/core.md` and `workflows/ask.md` through `mcp__plugin_doc-vault_vault__vault_context`. Use `vault_status`, `vault_list`, `vault_note`, `vault_search`, `vault_packet`, and `vault_read` to answer the question.

Answer with specific source paths and line references. Verify important generated claims against source; label inferred relationships. If the index is missing or stale, explain that condition rather than silently initializing or refreshing it during a read-only question. Do not publish notes unless the user explicitly asks to save the answer. No source evidence means the answer must remain an unresolved question or a clearly labeled general suggestion.
