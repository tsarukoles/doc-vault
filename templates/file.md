# File-note content template

Publish with `kind: file`, `slug: <exact primary source path>`, that path first in `source_paths`, and `review_status: draft`. The broker owns metadata, timestamps, identity, path selection, and generated headers. Supply concise evidence-backed content, not a second handwritten metadata block.

**Title:** the source's useful name or repository-relative path.

**Summary:** one or two sentences explaining its verified role.

Choose only applicable sections:

- **Role and contents:** principal declarations, rules, or configuration, and why callers use them.
- **Inputs and outputs:** relevant arguments, metadata, records, artifacts, or result statuses.
- **Execution and decisions:** consequential branches and dispatch behavior.
- **Relationships:** verified callers, dependencies, rules, and output consumers.
- **Failure and troubleshooting:** exception or validation paths and where to inspect next.
- **Open questions:** unavailable runtime context, unsupported extraction, or unresolved dynamic relationships.

Each substantive section needs exact source evidence. Use actual vault-note paths for wiki links, or plain source paths when no target exists. Do not invent notes. Keep short files short; omit empty headings.
