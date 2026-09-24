# File and folder analysis

Read `policies/documentation-style.md` through `vault_context` before drafting. Use numbered execution steps when order matters, simple explanations, and a small evidence-backed diagram or structure when it makes a complex process easier to follow. Keep ordinary verified wiki links alongside diagrams for vault navigation.

Use `vault_packet` for the source path, current hash, static facts, and related-source candidates. Read the relevant source ranges. Follow helpers, callers, fixtures, schemas, and configuration when they materially determine behavior. A filename, test description, import, or search match is a lead, not a complete explanation.

## Inspect before explaining

Build a compact evidence outline before drafting. For each meaningful operation record its inputs, condition, action, result, and supporting source. Trace at least one complete relevant input-to-result path; inspect alternate and failure paths before generalizing it. If the behavior is spread across files, include those sources rather than attributing all behavior to the entry file.

Cover the following when applicable; explicitly state a material unknown rather than silently omitting it:

| Question | What to inspect and explain |
|---|---|
| Why does the file exist? | Verified role, consumers, responsibilities, and boundaries. Separate declared intent from behavior. |
| What does it contain? | Important functions, classes, helpers, tests, rules, schemas, or configuration; explain how they cooperate. |
| How does it run? | Trigger, prerequisites, ordered steps, dispatch decisions, loops, early returns, asynchronous work, cleanup, and outputs. |
| What enters and leaves? | Shapes and meanings of parameters/data, defaults, environment/configuration, returned values, written artifacts, and side effects. |
| What can go wrong? | Validation, exception handling, retries/timeouts where present, partial failure, result/status reporting, and missing observable context. |
| What is verified? | Actual checks and assertions, their boundaries, and conditions they do not establish. |
| What connects it? | Inspected callers, dependencies, metadata/rules, downstream consumers, and unresolved dynamic or external edges. |
| What deserves attention? | Concrete inconsistencies, redundant candidates, or improvement opportunities with counterexamples, consequence, and uncertainty. |

## Tests require assertion-level reading

For each material test or coherent parameterized group, explain the scenario, setup/fixtures, action, expected condition, actual assertions, mocks/stubs, and teardown. Distinguish a test name's promise from what its assertions check. Identify inputs varied by parametrization and important branches represented or absent in the inspected tests. Follow helper assertions before deciding what is checked.

For example, an assertion that a return value is nonempty does not demonstrate its record count, contents, or persistence. A mocked service response establishes behavior under that mock; it does not establish the external service contract or deployment. Missing a local test is a coverage observation, not proof no test exists elsewhere. The analysis never runs tests and must not claim pass/fail results.

## Explain folders as components

Use `kind: component` for a meaningful folder or cooperating file group. Explain its responsibility, boundaries, entry files, file roles, internal sequence, shared configuration, outward dependencies, and where to investigate a failure. List the sources actually inspected. Do not infer a coherent component solely from folder placement. If a folder mixes unrelated responsibilities, describe the grouping honestly before proposing a reorganization.

## Publish useful detail

Use `templates/file.md`, `templates/component.md`, and `templates/flow.md` as applicable. Keep language simple: define unfamiliar terms at first use, use explicit actors and actions, and prefer an ordered example over vague phrases such as "handles processing." Depth follows complexity; simple files remain short, while multi-branch tests and pipelines need substantial detail. Avoid line-by-line paraphrases and copied boilerplate. A component note can hold shared details once, with links from file notes.

Every substantive section requires exact current evidence. Add all contributing paths to `source_paths`. For `kind: file`, put the primary source first and set `slug` to that source path. The broker derives the note path and stable identity. Read `vault_standards` for applicable rules and existing assessments; the broker appends the authoritative standards table. Do not author independent compliance labels in a second table.

Do not create file notes for Markdown/README sources; use them as evidence. Unsupported binary formats, truncated reads, and uninspected files remain visible limitations. Similar names, import proximity, or lexical extraction do not prove semantic relationships.

Before publishing, check whether a new engineer can explain the process, locate each important step, identify a failure path, understand what tests check, and distinguish findings from hypotheses. Check that any diagram agrees with the numbered explanation, branch conditions, and evidence. When the requested scope exceeds the available budget, finish a coherent group and name the remaining work instead of replacing detailed analysis with generic summaries.
