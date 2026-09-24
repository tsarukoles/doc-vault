# Flow-note content template

Publish as `kind: flow` with a safe descriptive slug, all contributing `source_paths`, and `review_status: draft`.

**Summary:** the evidenced trigger, work, and declared result.

- **Entry and prerequisites:** caller, event, configuration, and locally established assumptions.
- **Execution path:** ordered steps with actor, input, operation, output, and next recipient; label direct, configured, inferred, and unresolved relationships.
- **Decisions and data:** actual dispatch conditions, defaults, filtering, type/null conversions, transformation rules, input selection, and output meanings where applicable.
- **Failure paths:** at least one important failure path, including implemented validation, retries, exception handling, partial output, cleanup, and reporting boundaries.
- **Verification:** inspected checks/assertions and what they establish; mock, external, or runtime limits; relevant standards links.
- **Investigation and improvements:** where to inspect each failure, supported inconsistencies or gaps, proposed improvements, and their uncertainty.
- **External boundaries and unknowns:** information local source cannot establish.

Cite evidence for each substantive step and edge. A Mermaid diagram is optional and must match the prose and evidence. Do not let a diagram imply an unconditional or deployed connection that source does not establish.
