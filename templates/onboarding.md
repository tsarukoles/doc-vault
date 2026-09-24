# Onboarding content template

Publish as `kind: onboarding`, with a safe descriptive slug, contributing `source_paths`, and `review_status: draft`.

Apply `policies/documentation-style.md`. Assume the reader is new to this project. Define project terms and keep detailed implementation explanations in linked notes.

**Summary:** what a new engineer can learn from this guide and its evidence scope.

- **What this repository does:** supported purpose and key outputs.
- **Start here:** a numbered reading path through verified entry points and relevant source/vault links, explaining what each stop teaches.
- **How the parts fit:** a small evidence-backed structure or component/process diagram when useful, with ordinary verified wiki links for navigation and the Obsidian graph.
- **Follow one path:** a representative input-to-result explanation in numbered steps, with decisions, checks, and an important failure path where established.
- **Where behavior is configured:** configuration, rules, metadata, environment selection, and declared boundaries.
- **Where to investigate failures:** concrete implementation locations and diagnostic questions.
- **Documented setup:** only source-supported instructions, with a statement that they were not executed during analysis.
- **What remains unknown:** runtime state, unsupported sources, and missing context.

Omit unsupported sections. Do not invent maintainers, support channels, credentials, setup commands, or permissions. Label inferred and unresolved diagram connections rather than filling gaps. Keep detailed function descriptions in file notes. Keep note paths stable; use ordered reading links rather than numeric file renames.
