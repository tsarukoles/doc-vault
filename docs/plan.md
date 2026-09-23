# Implementation decisions and acceptance plan

## Product decisions

| Decision | Reason |
|---|---|
| Claude Code plugin with a local MCP broker | Reuse the approved host model while making filesystem operations narrow and inspectable. |
| Default ignored `doc-vault/` output | Keep generated knowledge local to the checkout without modifying application source. |
| Controlled root `.gitignore` append | Make the output ignore rule explicit and idempotent. |
| Static baseline before model enrichment | Supply useful navigation and transparent coverage even before explanations are complete. |
| Sequential forked curator | Avoid depending on nested agent availability. |
| Separate reviewer and revision-bound records | Distinguish generation from an independent evidence check. |
| Component-level capability profiles | Support mixed repositories without forcing a single filename-based type. |
| Structured publication with source hashes | Reject stale evidence and arbitrary write paths. |
| Optional static watcher; no Git-hook installation | Detect local changes without modifying Git configuration. |
| No direct provider SDK | Use the host's existing approved provider and credentials. |

## Acceptance criteria

The local runtime is acceptable for a pilot when synthetic tests demonstrate these behaviors:

1. Scan leaves source bytes unchanged except the exact documented `.gitignore` addition, which remains idempotent.
2. Supported sources receive useful baseline notes; Markdown remains reference material; excluded and unsupported inputs have visible reasons.
3. File maps and wiki targets are internally valid, with timestamps, IDs, and source fingerprints supplied by the broker.
4. Supported import/reference relationships help navigate the synthetic E2E and data-control fixtures without claiming complete semantics.
5. Source edits, additions, deletions, and unambiguous renames refresh static state and invalidate affected explanations.
6. Human notes under `annotations/` remain untouched by managed refresh.
7. Publication rejects missing, stale, out-of-range, or unauthorized source evidence and preserves the last valid note after rejection.
8. A review applies only to the exact note revision and valid current evidence.
9. Traversal, symlink/junction, and arbitrary output-path attempts fail within the tested boundary; repository instruction-like text is never executed.
10. CLI and MCP behavior use the same broker logic, with no direct model request or source-code execution.

Tests are evidence for their exercised cases, not proof of every filesystem or model behavior. Run `node --test` from the plugin checkout and inspect failures before making release claims.

## Host pilot still required

In an approved Claude Code environment, verify local loading, marketplace installation, actual MCP tool names, target-root selection, skill routing, tool restrictions, and the separate review flow. Use a synthetic repository first. Confirm that source output reaches only the approved host/provider and that the plugin does not ask for broader tools.

Have an engineer use the generated vault to locate an entry point, trace an execution path, identify a failure boundary, and distinguish supported facts from unknowns. These usability checks evaluate knowledge quality beyond schema validation.

## Later extensions

Candidate extensions are deeper syntax/framework readers, value-aware approved workbook extraction, explicit cross-repository registration, richer operational evidence, and a separately designed sharing mechanism. Each needs its own provenance, permission boundary, and acceptance cases. Do not advertise these as current functionality.
