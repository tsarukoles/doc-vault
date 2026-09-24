# Reading the generated vault

Open `edw-doc/` as an Obsidian vault or read its Markdown in an editor. Start at `index.md`, then choose onboarding, the file map, or a flow investigation. A custom configured vault name is supported; the default changed in version 0.1.1.

```text
edw-doc/
  index.md                    Main navigation and coverage summary
  analysis-index.md           Agent explanations, semantic coverage, and review status
  file-map.md                 Included files and reference documents
  project-map.md              Initial groups and discovered relationships
  repository-profile.md       Static purpose hypothesis and capability evidence
  files/                      Per-source notes, mirroring safe source paths
  components/                 Boundaries and enriched component explanations
  flows/                      Connection inventory and enriched execution flows
  standards/                  Rule descriptions, categories, and links back to files
  improvements/               Advisory findings and static candidates
  profiles/                   Agent-enriched purpose and capability notes
  onboarding/                 Overview, setup evidence, first task, and glossary
  troubleshooting/            Evidence-backed investigation starting points
  reports/                    Coverage, audit limits, and unresolved questions
  history/                    Latest analyzed snapshot information
  annotations/                Your own notes, outside managed generation
  .system/                    Runtime index, publication, review, and assessment records
```

Some directories appear only when their note type is published. The `.system/` directory is implementation state; do not edit it manually.

The standards catalog groups rules under applicable categories such as languages, testing, CI/CD, databases, and transformations. Each file note's standards table links to its relevant rules; each rule links back to files and results. The coverage report distinguishes candidates that were not assessed, source-backed verdicts, unknowns, and stale work. These tables are generated from structured records, rather than independently handwritten copies. See [standards](standards.md).

A source such as `application/checks.py` has a managed note under `files/application/checks.py.md`. Special path characters are encoded by the broker. Agents obtain the actual note path from inventory rather than reconstructing it.

Wiki links connect existing notes inside the vault, for example `[[files/application/checks.py|application/checks.py]]`. Source links are repository-relative Markdown links and may leave the vault directory; opening them depends on the viewer's filesystem-link support. The source path and evidence locator remain readable even when a viewer cannot open that link. Workstation-specific absolute paths are not required for vault navigation.

## Interpreting metadata

Static baseline notes identify source structure and analysis limitations. Agent-enriched notes contain explanations with source evidence and begin as drafts. Timestamps identify when content was generated or mechanically verified, not when someone approved it. Source hashes identify the bytes used for analysis, including eligible uncommitted files.

Separate review records associate an agent verdict with an exact note hash and current evidence. A supported verdict is limited to its recorded scope. Replacing a note or changing its evidence makes the previous verdict inapplicable.

## Personal annotations

Put observations, investigation logs, and human context under `annotations/`. Managed refresh preserves this area. If you edit a generated note, the publisher detects the mismatch and stops rather than silently discarding the change. Move your addition into an annotation before refreshing.

Notes and metadata are local because the vault is ignored. Another engineer normally generates a separate vault from their own checkout. Git pulls and pushes do not share personal annotations or generated explanations.
