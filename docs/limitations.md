# Known limits

This version provides a deterministic local baseline and a broker-guided host-agent workflow. The following are deliberate limits, not hidden completeness claims.

- **Host smoke testing remains required.** Local Node tests cannot verify actual Claude Code plugin discovery, MCP naming, forked-agent behavior, or approved-provider integration. The development environment did not include a Claude Code installation.
- **Extraction is bounded and lexical.** It can miss or misread comments, strings, aliases, complex imports, generated code, dynamic dispatch, and framework wiring. It does not produce a complete call graph.
- **Purpose is a hypothesis until inspected.** Capability signals and directory groupings assist discovery; the model must verify representative behavior and label uncertainty.
- **Workbook content is partial.** The XLSX reader exposes structure rather than values or formula expressions. Legacy XLS, arbitrary document formats, and unsupported workbook variants are not full semantic inputs.
- **No runtime verification.** Tests, builds, migrations, scripts, formulas, macros, pipelines, and cloud operations are not executed. Deployed configuration and actual data lineage remain unknown.
- **Sensitive-data filtering is incomplete.** Source selection and filtering reduce exposure but are not comprehensive DLP. Host/provider policy still governs material the agent reads.
- **Ignored and excluded subtrees are not exhaustive file maps.** Coverage must distinguish an excluded subtree from individual files actually inspected.
- **Renames are conservative.** Exact, unambiguous content matches may preserve identity. A rename with edits or duplicate content can remain delete/add.
- **Local refresh has two parts.** CLI/watch refreshes static state; an active skill updates model explanations. There is no unattended background model service.
- **The vault is local.** Git ignore prevents ordinary source commits from sharing it; this version does not provide team merges, remote publishing, or cross-repository aggregation.
- **Checks have different meanings.** Lint validates mechanics. Agent review assesses source support. Neither establishes human approval, formal compliance, or complete correctness.
- **Standards assessments are qualified source judgments.** Bundled guidance is advisory and offline. Repository rule registration and static checks cannot prove that an organization adopted a mandate, that a linter ran, or that an assessment is semantically correct. Applicability candidates require inspection; unknown, not-assessed, and stale results remain visible.
- **Ignored settings may still be tracked.** The root `.claude` ignore rule does not remove previously committed settings. The plugin reports tracked paths without changing Git tracking or settings content.
- **Agent restrictions are not universal isolation.** Other host tools and sessions remain governed by their own permissions. Use a native sandbox for stronger host-wide enforcement.

For an unsupported area, preserve the useful baseline, show the missing evidence, and identify the reader or operational source needed to improve it. Do not silently fill the gap with invented detail.
