# Standards discovery and assessment

## Establish current scope

Call `vault_status`; require an initialized, current snapshot. If missing or stale, explain the build/sync prerequisite. This specialist cannot scan or refresh. Call `vault_standards` for the current rules, scope, hashes, applicability candidates, recorded assessments, and coverage. Page through its `offset` and `limit` results (maximum 100 rules per call); optional `path` narrows to one source. Use the returned rule `id` and `hash` exactly. Page through `vault_list` and inspect the repository profile and representative sources before selecting languages and categories.

## Establish each rule's authority

Inspect eligible reference documents, configuration, schema definitions, and source. Load only relevant domain packs. The offline catalog is curated guidance; do not claim it is the latest web guidance or that the repository adopted it.

- **Declared:** an explicit requirement in current repository policy, configuration, schema, or contract. Cite the exact statement and narrow its scope. A linter configuration declares selected rules; it does not establish that they were executed or passed.
- **Convention:** repeated behavior across an inspected sample. Describe that sample and counterexamples; do not invent a mandate.
- **Advisory:** a bundled recommendation with maintained provenance. Use it as guidance unless an independently evidenced repository requirement adopts the rule.

Register repository-derived rules with `vault_rule`, following `schemas/rule-input.schema.json`. Supply an actionable requirement, why it matters, a source-inspection verification method, scope, and current evidence. Avoid vague rules such as "use best practices." Reuse an existing equivalent rule rather than multiplying overlapping entries. Keep bundled advisory IDs intact; a local adoption is a separate declared rule with local evidence.

Scope lists match by OR: a language match or kind match or path match selects a file. Path entries are exact paths or directory prefixes, not globs. All lists empty selects all included files. To constrain a rule to one component, use its narrow path scope rather than adding a language that would broaden the match.

When policy and configuration conflict, record the conflict and use `unknown` for the disputed assessment. Do not silently choose the rule that produces a preferred result. A legitimate exception must be evidenced and explained in the rationale; unsupported assumptions are not waivers.

## Inspect and assess

Work in bounded file/component batches. Obtain a current packet and inspect relevant source ranges, helpers, tests, schemas, and pipeline configuration. Applicability candidates are routing hints, not findings. Verify version-specific assumptions from available manifests/configuration. Record results with `vault_assess` using the exact source hash and current rule hashes, following `schemas/assessment-input.schema.json`.

| Result | Evidence needed |
|---|---|
| `complies` | Inspected evidence satisfies the specific applicable rule within the stated scope. |
| `diverges` | The source differs from advisory guidance or a convention; explain whether the difference could be intentional. |
| `noncompliant` | Demonstrated violation of an explicit, applicable **declared** requirement. |
| `unknown` | Missing, unsupported, contradictory, dynamic, or runtime-only evidence prevents a conclusion. |
| `not-applicable` | Inspectable evidence shows the rule's condition or responsibility does not apply to this file. |

`not-assessed` is the broker's initial coverage state; do not submit it as a completed verdict. Stale results also remain visible until reassessed. Do not set all candidate rules to `complies` because no obvious issue was found. One passing-looking example cannot establish a universal claim. Each assessment needs its own rationale and current supporting locators, including at least one from the assessed file. Additional evidence can establish helper behavior or a legitimate exception. Explain precisely what was inspected and what was not executed.

Inspect standards across responsibilities: scripting language behavior, test verification, CI/CD configuration, database operations, and file/data transformations only where those capabilities exist. A rule implemented at a caller or shared boundary may be satisfied there; inspect that boundary before calling its absence in a helper a violation. Broader safety or operational guarantees often require `unknown` under static inspection.

## Publish and maintain

The broker generates standard descriptions, category navigation, reverse file links, file-note tables, and coverage. Do not create or edit those files yourself, and do not duplicate verdicts in free-form prose. It binds assessments to source and rule hashes, so source, governing policy, or pack changes require reassessment. Personal annotations remain separate.

Finish with assessed scope, not-assessed/stale/unknown gaps, supported discrepancies, conflicts, and useful next steps. Standards assessment does not run linters or certify the repository. A separate `/edw-doc:review` pass should inspect significant or disputed results against original evidence; the reviewer records a qualified note review rather than overwriting assessments.
