# Read-only status

Call `vault_status` and summarize only what it reports. Useful distinctions are: absent or initialized; indexed source state; source changes; static file coverage; model-enriched notes; stale explanations; missing ignore rules or tracked `.claude` warnings; and separately recorded review state. Use `vault_standards` only when the initialized inventory is fresh to inspect assessed, not-assessed, unknown, and stale standards work. Otherwise use the live standards counts in status and report sync as the prerequisite for deeper inspection.

Use read-only inventory or note inspection if necessary. Do not initialize, refresh, publish, or record reviews. Avoid lint if it persists a report. When a metric is not reported, say it is unavailable rather than deriving a misleading completeness percentage.

Keep output short and actionable: current condition, significant gap, and the appropriate next command. A current inventory does not establish that all flows were understood or any runtime behavior was tested.
