# Documentation style

Apply this guide to generated explanations, flows, findings, and onboarding. It controls presentation; the evidence and permission rules in `policies/core.md` still apply.

## Make the explanation useful to a newcomer

Start with what the item does, why it matters to the process, and where it fits. Use short sentences, familiar words, and explicit actors: "The loader reads the CSV" is clearer than "CSV processing is handled." Define an unfamiliar term at first use. Separate observed behavior, declared intent, suggestions, and unknowns.

Explain important mechanics rather than repeating names: inputs, decisions, operations, outputs, checks, and failure outcomes. Depth follows complexity. A short configuration file may need a paragraph; a pipeline or test group may need a full walkthrough. Put shared details in a component or standards note and link to them.

## Use numbers when order matters

Use numbered steps for execution sequences, setup instructions supported by source, investigations, and onboarding reading paths. Say when branches or parallel work have no fixed order. Use bullets or tables for independent facts. Keep broker-owned source paths and note identities stable; do not rename file notes merely to add numeric prefixes.

## Draw processes and structures when useful

Include a small Mermaid diagram or text structure when a flow, branching decision, component boundary, or data shape is easier to understand visually. Prefer a flowchart for decisions and data movement, a sequence diagram when interaction order matters, and a tree/table for file or schema structure. Use an entity-relationship diagram only when the inspected schema establishes the relationships and cardinality. A simple straight-line operation may need only numbered prose.

Every node and relationship must be supported by inspected evidence. Label configured, inferred, external, and unresolved connections. Show meaningful branch conditions and one important failure path where established. Never invent a step, deployment, database relationship, or service connection to complete a diagram. Keep missing steps as explicit boundaries. Match the diagram to the prose and cite the supporting sources in the surrounding section. If rendering is unavailable, do not claim the diagram was rendered or visually verified.

Keep diagrams small enough to read; split a large process into an overview and linked details. Use clear labels and simple Mermaid syntax. The numbered walkthrough must still explain the process without relying on the diagram.

## Make the vault navigable

Use ordinary `[[verified-note-path|clear label]]` links for relevant file, component, flow, and standards notes. Obtain targets from the broker or existing notes; never guess them. These links provide Obsidian navigation and graph connections. Mermaid relationships alone do not populate the Obsidian graph. A link expresses a documented relationship, not proof of a runtime call or an external deployment.

Use descriptive section titles and a small "Read next" list when it helps a newcomer continue. Keep source timestamps, hashes, canonical standards tables, and generated metadata under broker control.

## Check before publishing

Can a reader identify the starting point, follow the important steps, locate their source, understand what is checked, and see where the evidence ends? Do the prose, diagram, links, and standards references agree? Fix unsupported conclusions and broken navigation before adding more detail. Do not fill a template with generic text to hide missing evidence.
