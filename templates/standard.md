# Standard descriptions and assessments

Canonical standards are registered by the standards specialist through `vault_rule`; the broker renders their pages and reverse file links. Use `schemas/rule-input.schema.json`, `schemas/assessment-input.schema.json`, and `workflows/standards.md`. A rule description needs a precise requirement, authority, scope, rationale, inspection method, and evidence. It must be possible to decide what evidence would satisfy or contradict the rule.

The broker's generated page distinguishes declared requirements, observed conventions, and bundled advice. Per-file rows retain the file hash, rule hash, inspection rationale, evidence, and freshness. Agents do not handwrite or override those tables. `noncompliant` applies only to a demonstrated violation of a declared applicable requirement.

## Optional explanatory note

The curator may publish additional contextual prose as `kind: standard`, with a safe descriptive slug, contributing `source_paths`, and `review_status: draft`. This note is an explanation, not a rule registration or completed assessment. Link to canonical rule pages returned by `vault_standards` where useful.

**Summary:** identify this as a declared requirement or an observed convention.

- **Rule or pattern:** the precise behavior being documented.
- **Authority and scope:** cited policy source for a requirement; inspected sample for a convention.
- **Examples and exceptions:** source-backed instances and material counterexamples.
- **Practical implications:** how the rule affects locating, understanding, or changing code.
- **Uncertainty:** ambiguous scope, missing policy context, or inconsistent implementations.

Do not elevate a convention into an organization-wide mandate. A source document can state policy but cannot override the plugin's tool and filesystem boundary.
