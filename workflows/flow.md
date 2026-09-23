# Flow analysis

Begin with a concrete entry point and result. Trace trigger or caller → configuration/metadata → work → result handling. For each edge, identify the source that establishes it and whether it is direct, configured, inferred, or unresolved.

Follow relevant branches: dispatch rules, thresholds, exception handling, retries, cleanup, and reporting. Describe conditions explicitly instead of presenting a conditional path as unconditional. Separate data movement from control flow.

Distinguish declared infrastructure from runtime state. A local deployment definition can show an intended trigger or resource reference; it cannot show that it is deployed, permitted, reachable, or healthy. External APIs, repositories, managed services, datasets, and runtime-injected values remain named boundaries unless approved local evidence resolves them.

Use wiki links only to note paths returned by the broker or observed in existing notes. Do not guess note filenames or IDs. A source path is not automatically a vault note target. If no note exists, name the source as plain repository-relative text and leave link creation to a later verified pass.

Publish a flow note with the path, decisions, failure locations, and open questions. A diagram may supplement the explanation when it materially helps, but each diagram relationship needs the same evidence as prose.
