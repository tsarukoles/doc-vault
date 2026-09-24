# Doc Vault 0.1.2

This release adds optional local instruction integration, maintenance at Claude Code checkpoints, and clearer documentation guidance. The default vault remains `edw-doc/`; the plugin and `/doc-vault:*` command names are unchanged.

## Changes

- Separate `setup`, `setup-status`, and `uninstall` CLI commands manage local integration without expanding analysis-agent permissions. They require an explicit repository root.
- Setup adds owned `.claude/doc-vault` files and reuses a single existing, locally ignored Claude instruction file with a marked import. Tracked, unignored, AGENTS-only, and ambiguous setups remain unchanged and use an ignored rule adapter. With no detected entry point, setup creates an ignored root `CLAUDE.md`. It never creates `CLAUDE.local.md` or changes Claude settings, global instructions, or Git hooks.
- Ownership records protect user edits during repeated setup and removal. Unowned path collisions are errors. Uninstall preserves edited content, ignore entries, directories, and the vault; automatic maintenance is disabled even if edited configuration remains.
- Installed configuration selects the default vault for CLI and MCP use. Conflicting host environment configuration is rejected rather than silently separating hooks from the broker. Existing configuration is preserved during setup updates.
- Optional hooks reconcile an existing vault at session start, new prompts, tool activity, and agent completion. Plan-mode and subagent events are skipped; broker tool events are skipped and other tool events throttled. Hooks do not initialize a vault or start a permanent watcher.
- Static refresh records source changes and pending model analysis. The finish hook can request one main-agent sync continuation per pending snapshot, guarded against recursion. Incomplete work stays visible; standards assessment and independent review remain separate commands.
- The shared [documentation style](../policies/documentation-style.md) calls for simple explanations, meaningful numbering, and evidence-backed diagrams or structures where useful. Stable note paths and ordinary wiki links support Obsidian navigation.
- The new [business overview](business-overview.md) explains capabilities, preservation rules, scope, and limits in plain language.

## Upgrade and enable local maintenance

Update the plugin using the existing approved distribution method and start a fresh Claude Code session. Existing manual build/sync workflows continue without local setup. To enable or update integration for a target Git repository, run:

```sh
node /absolute/path/to/doc-plugin/scripts/cli.mjs setup --root /absolute/path/to/repository
node /absolute/path/to/doc-plugin/scripts/cli.mjs setup-status --root /absolute/path/to/repository
```

For a custom vault, supply the same `--vault-name` used by its integration when running setup. Review reported warnings. Instruction activation remains `unverified` until checked in the actual host; setup cannot inspect the full host configuration.

Setup does not build a vault. Run `/doc-vault:build` for a new target or `/doc-vault:sync` for an existing vault, then `/doc-vault:standards` and `/doc-vault:review` as needed. Revised writing guidance applies during fresh AI analysis, not by updating the plugin files alone. Migration from a legacy `doc-vault/` folder remains explicit; see [installation and updates](installation.md).

To remove only the local integration:

```sh
node /absolute/path/to/doc-plugin/scripts/cli.mjs uninstall --root /absolute/path/to/repository
```

## Validation and limits

See [the validation record](validation.md) for automated checks and remaining host checks. No live Claude Code installation was available in the development environment. Real plugin loading, instruction activation, hook dispatch, stop continuation, and approved-provider integration still require an environment smoke test.

Session hooks do not run while Claude Code is closed. External edits and Git changes are discovered at the next eligible event or explicit static watcher scan. A requested AI continuation does not establish complete analysis, independent review, or human approval. Source execution, cloud inspection, cross-repository crawling, and publication remain outside scope.
