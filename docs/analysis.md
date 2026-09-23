# Analysis model and support

## Three layers of understanding

**Purpose** describes the repository's evidenced outcome. **Capabilities** describe component work such as browser tests, metadata loading, validation, transformation, or orchestration. **Technology** describes the languages, formats, and frameworks implementing that work.

The static profiler emits signals and hypotheses. The agent confirms or qualifies them by tracing representative entry-to-result paths. A repository may contain several capabilities without one framework defining its entire purpose.

## What the runtime extracts

| Input | Baseline support | Limit |
|---|---|---|
| Supported text/code/configuration | Bounded text, fingerprints, lexical declarations, selected capability signals | Lexical patterns are not complete syntax analysis. |
| Python | Selected declarations and local import candidates | Dynamic imports, package configuration, aliases, and runtime wiring can be unresolved. |
| JavaScript/TypeScript | Selected declarations and import/reference candidates | Path aliases, runtime resolution, generated modules, and dynamic behavior can be unresolved. |
| Infrastructure and pipeline definitions | Source text and selected declaration signals | No deployed-state, permissions, or execution verification. |
| CSV/TSV | Structural summary and bounded text available for inspection | Header detection and delimiter inference are heuristic; consumers establish semantics. |
| XLSX | Bounded workbook/sheet structure, cell addresses/types, and cell/formula counts | Values and formula expressions omitted; no formula evaluation or macro execution. |
| Markdown and README-like documents | Reference material | No duplicate per-file documentation note. |
| Unsupported, oversized, binary, ignored, or sensitive inputs | Coverage status and reason where discoverable | Contents are not analyzed. Skipped subtrees are not recursively inventoried. |

Read the actual inventory result rather than assuming every extension is supported. Failed workbook extraction remains a disclosed limit. External services and other repositories are boundaries, even when their names occur in local configuration.

## Evidence levels

- **Observed source fact:** a declaration, literal configuration, or extracted structural fact.
- **Attributed statement:** a source document's stated purpose or rule, identified as such.
- **Inference:** a relationship or interpretation supported by sources but not directly established.
- **Unknown:** evidence is missing, dynamic, unsupported, or outside scope.

Examples: an import supports a dependency candidate; it does not prove a function is called. A test assertion supports an expected behavior; it does not prove the test passed. A deployment file supports a declared resource; it does not prove that resource exists.

## Practical completeness

Track at least three scopes separately: inventory coverage, model enrichment, and evidence review. A file can have a static baseline note while its operational purpose remains unresolved. A current hash can establish freshness without establishing semantic quality.

File notes should be concise. Component and flow notes explain cross-file behavior once. Onboarding links those explanations into a useful reading path. This prevents one-note-per-file coverage from turning into repetitive prose.

## Extending analysis

Add a domain pack when the existing readers expose enough evidence but the agent needs a new lens. Add or change a reader/analyzer when the required structure cannot be extracted reliably. A YAML signature or prompt alone cannot provide missing parsing semantics.

New readers must preserve bounded access, source provenance, and failure visibility. Use synthetic fixtures to verify the new behavior before distributing a new plugin version.
