# Onboarding

Read `policies/documentation-style.md` through `vault_context`. The guide should work for someone who knows nothing about this repository: define project terms, explain the purpose before implementation detail, and use clear links to deeper notes.

Read current profile, component, and flow notes where available, then verify the key entry points against sources. If there is no index and the user requested a guide, initialize with `vault_scan`; model explanations must still be grounded in source.

Organize around a new engineer's tasks: understanding the purpose, finding the first executable entry point, following one representative path, locating configuration and rules, and identifying likely failure locations. Use `templates/onboarding.md`. Give the reading path a numeric order, with a short explanation of what each stop teaches. Preserve broker-owned note names and paths; order navigation rather than renaming source notes.

Include a small project structure, component map, or representative process diagram when it clarifies how the parts cooperate. Show only relationships established by inspected sources; label external systems, inferred connections, and unresolved steps. Pair the picture with a numbered walkthrough and ordinary verified wiki links, since Mermaid edges alone do not populate the Obsidian graph. Link to detailed flow and file notes rather than copying their full explanations.

Describe only setup instructions actually present in sources, with attribution. Do not invent package commands, environment variables, deployment steps, access requests, ownership, or support contacts. Do not execute the documented steps.

A troubleshooting map should connect a symptom category to evidence-backed code locations and questions to investigate. Without runtime observations, it is not a diagnosis. Publish a concise guide with source evidence and explicit unknowns.
