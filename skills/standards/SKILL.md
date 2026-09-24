---
name: standards
description: Catalog repository coding and process standards, assess applicable files, and link results to their evidence.
context: fork
agent: doc-vault:standards
background: false
---

Assess standards for the broker's configured repository, optionally narrowed by the user's requested paths or technologies.

1. Read `policies/core.md`, `workflows/standards.md`, and `packs/standards.md` through `mcp__plugin_doc-vault_vault__vault_context`.
2. Check `vault_status`. A current initialized snapshot is required; report a missing build/sync prerequisite rather than attempting unrestricted setup.
3. Follow the standards workflow: inspect applicable rules, cite repository requirements or conventions, and assess current file/rule revisions.
4. Report coverage, evidence-backed results, uncertainty, and any remaining work. The broker generates standards pages and both directions of wiki links.

This is static source assessment. Do not execute linters, tests, transformations, migrations, pipelines, or remote checks. A later `/doc-vault:review` invocation can challenge the recorded explanations and evidence in a separate context.
