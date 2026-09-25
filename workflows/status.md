# Read-only status

Call `vault_status` and summarize only what it reports. Useful distinctions are: absent or initialized; indexed source state; source changes; static file coverage; model-enriched notes; stale explanations; missing ignore rules or tracked `.claude` warnings; and separately recorded review state. Use `vault_standards` only when the initialized inventory is fresh to inspect assessed, not-assessed, unknown, and stale standards work. Otherwise use the live standards counts in status and report sync as the prerequisite for deeper inspection.

Report project integration separately from vault freshness. Inspect `integration.installed`, `entrypoint`, `integrationPath`, `maintenanceEnabled`, `activation`, and warnings when present. Missing, edited, conflicted, or disabled integration must remain visible even when source is fresh. File presence does not establish host activation. For missing integration in a Git project, point to an approved `/edw-doc:build` or `/edw-doc:sync`; explicit CLI setup is available for repair, but status must never perform it.

Use the reported ignore diagnostics: `git_verified`, `git_root`, `repository_root`, `output_paths`, `effective_rules`, and `tracked_vault_files`. State whether Git actually verified exclusion and whether output is already tracked. Show the relevant root or path when it explains a mismatch. A visible editor folder or a matching line of ignore text alone does not establish Git tracking status. Do not recommend untracking files or widening ignore rules automatically.

Use read-only inventory or note inspection if necessary. Do not initialize, refresh, publish, or record reviews. Avoid lint if it persists a report. When a metric is not reported, say it is unavailable rather than deriving a misleading completeness percentage.

Keep output short and actionable: current condition, significant gap, and the appropriate next command. A current inventory does not establish that all flows were understood or any runtime behavior was tested.
