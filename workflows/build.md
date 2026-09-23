# Build

1. **Initialize and inventory.** Call `vault_scan`. It creates static source facts, maps, and an initial onboarding baseline. Inspect exclusions and unsupported files. The baseline is useful navigation, not completed model analysis.
2. **Discover purpose.** Load `workflows/discovery.md`. Page through `vault_list`; inspect representative entry points with `vault_packet` and `vault_read`. Form an evidence-backed profile of purposes and component capabilities. Read Markdown references when useful, without creating file notes for them.
3. **Choose lenses.** Load `packs/e2e.md` for E2E capabilities, `packs/data-controls.md` for metadata-driven checks or pipelines, and `packs/generic.md` elsewhere. A mixed repository can use several lenses. File extensions select readers; connected behavior selects the lens.
4. **Analyze bounded batches.** Load `workflows/file-analysis.md`. Group sources by component and inspect one manageable group at a time. Follow only dependencies necessary to establish claims. Enrich each meaningful supported source within the requested scope; use exact source path as the file-note slug. Unsupported or uninspected sources remain explicit gaps.
5. **Connect components.** Load `workflows/flow.md` and `templates/flow.md`. Trace representative execution paths, including configuration and failure boundaries. Publish component, flow, and profile drafts with relevant evidence.
6. **Orient a new engineer.** Use `workflows/onboard.md` to create a guide from verified entry points and flows. Do not duplicate every file note in the guide.
7. **Self-check and finish.** Compare important claims with source, run `vault_lint`, and resolve mechanical errors within the permitted scope. Report source inventory, enriched scope, remaining work, and absence or presence of separate agent review.

If the repository exceeds the available context or run budget, finish the current coherent component, publish only supported results, and explicitly name unprocessed components. Do not replace incomplete analysis with generic prose. Further build runs can continue enrichment; static coverage and semantic coverage are different measures.
