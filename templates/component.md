# Component content template

Publish as `kind: component`, with a safe descriptive slug, contributing `source_paths`, and `review_status: draft`.

**Summary:** the component's evidenced responsibility and declared result.

- **Boundary and entry points:** the meaningful folder or cooperating file group, why it exists, and the interfaces establishing its boundary.
- **File-role map:** each important inspected file's role and its verified note link; distinguish uninspected members.
- **How the files work together:** an ordered entry-to-result example with helpers, dispatch decisions, and intermediate values.
- **Inputs and outputs:** accepted data/configuration, declared result, side effects, and consumers.
- **Configuration and decisions:** metadata, rules, schemas, defaults, and sources that select behavior.
- **Checks and failure paths:** what gets validated, where failures propagate or are handled, and where an engineer should inspect next.
- **Verification and practices:** inspected test coverage and relevant standards links, without duplicating the broker's per-file verdicts.
- **Findings and unknowns:** concrete placement or responsibility concerns, tradeoffs, counterexamples, uninspected files, and unresolved external context.

Use verified wiki targets for navigation. Explain shared responsibilities once here and link to detailed file notes. Do not infer a module boundary solely from a folder name. A newcomer should be able to choose the correct file for a change or investigation from this note.
