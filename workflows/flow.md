# Flow analysis

Begin with a concrete entry point, representative input, and result. Trace trigger/caller → configuration or metadata → selection/dispatch → work → validation → result handling. Follow the implementation through helpers and intermediate data structures. For every edge, cite the source that establishes it and label it direct, configured, inferred, or unresolved.

For each step explain who performs it, the input consumed, the decision made, the data produced, and who receives the result. Show meaningful branches with their actual conditions, including early returns, empty inputs, malformed values, exception paths, retries, cleanup, and reporting where implemented. Separate data movement from control flow. Never present one branch as an unconditional path.

For data processes, inspect selection rules, schema/type conversions, null/default handling, filtering, joins/aggregation, write modes, transaction boundaries, and failure outcomes where present. A workbook shape cannot establish unseen cell values or rule meaning. A SQL statement cannot establish production constraints or isolation unless supported by available configuration. For test automation, connect fixtures, actions, waits, assertions, mocked boundaries, and cleanup.

Trace at least one important failure path alongside the successful path. Explain which failures are detected, which are propagated or swallowed, and where an engineer would inspect next. If a check's existence is clear but its operational effectiveness requires runtime evidence, say so.

Distinguish declared infrastructure from runtime state. A local deployment definition can show an intended trigger or resource reference; it cannot show that it is deployed, permitted, reachable, or healthy. External APIs, repositories, managed services, datasets, and runtime-injected values remain named boundaries unless approved local evidence resolves them.

Use wiki links only to note paths returned by the broker or observed in existing notes. Do not guess note filenames or IDs. A source path is not automatically a vault note target. If no note exists, name the source as plain repository-relative text and leave link creation to a later verified pass.

Publish a flow note with ordered steps, inputs/outputs, decisions, failure locations, verification boundaries, and open questions. A Mermaid diagram supplements the explanation; every relationship requires the same evidence as prose.
