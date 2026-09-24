# Flow-note content template

Publish as `kind: flow` with a safe descriptive slug, all contributing `source_paths`, and `review_status: draft`.

Apply `policies/documentation-style.md`. Use plain language and define unfamiliar terms. Use numbers for execution order and name conditional or parallel work explicitly.

**Summary:** the evidenced trigger, work, and declared result.

- **Entry and prerequisites:** caller, event, configuration, and locally established assumptions.
- **Execution path:** numbered steps with actor, input, operation, output, and next recipient; label direct, configured, inferred, and unresolved relationships.
- **Process view, when useful:** a small Mermaid flowchart, sequence diagram, or text structure showing evidenced boundaries, decisions, and important failure paths. Pair it with ordinary verified wiki links to the participating notes.
- **Decisions and data:** actual dispatch conditions, defaults, filtering, type/null conversions, transformation rules, input selection, and output meanings where applicable.
- **Failure paths:** at least one important failure path, including implemented validation, retries, exception handling, partial output, cleanup, and reporting boundaries.
- **Verification:** inspected checks/assertions and what they establish; mock, external, or runtime limits; relevant standards links.
- **Investigation and improvements:** where to inspect each failure, supported inconsistencies or gaps, proposed improvements, and their uncertainty.
- **External boundaries and unknowns:** information local source cannot establish.

Cite evidence for each substantive step and edge. Include a visual when the process benefits from one; a simple straight-line operation may use numbered prose alone. Match the visual to the prose and evidence. Do not let a diagram imply an unconditional or deployed connection that source does not establish. Mermaid edges alone do not create Obsidian graph links.
