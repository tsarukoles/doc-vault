# Installation and updates

## Local development or evaluation

Use Node.js 20 or later, Claude Code CLI 2.1.199 or later, and Git when documenting a Git repository. Version 0.2.0 retains the CLI's mandatory tool approval requirement introduced in 0.1.3; see [run approval](run-approval.md). There is no dependency installation step for the local runtime. Configure the host's approved model/provider independently; EDW Doc does not create credentials or make direct model-provider calls.

From the repository to document:

```sh
claude --plugin-dir /absolute/path/to/edw-doc-plugin
```

Run `/edw-doc:status` to inspect the configured repository. Run `/edw-doc:build` to create the ignored `edw-doc/` vault. Build/sync creates a missing root `.gitignore` or appends the configured vault rule and `/.claude/`; existing content is preserved. The default rules are `/edw-doc/` and `/.claude/`. Already tracked `.claude` files are reported without changing tracking. All other ordinary analysis output stays under the vault. Without the optional setup below, the session-start hook only reports status; it never creates or refreshes the vault or ignore rules.

After build, run `/edw-doc:standards` for the dedicated standards assessment, then `/edw-doc:review` for a separate source-evidence review. Static baseline notes and initial standards candidates are not completed AI analysis.

The examples use POSIX-style absolute paths. On Windows, quote an absolute path such as `"C:\path\to\edw-doc-plugin"`. The plugin location and target repository are different paths. Do not run a target scan against the installation directory by mistake.

## Optional local integration

Setup is an explicit operator CLI command, separate from plugin loading and ordinary build/scan. It requires an inspectable Git repository root and does not build the vault or grant new tools to analysis agents.

```sh
node /absolute/path/to/edw-doc-plugin/scripts/cli.mjs setup --root /absolute/path/to/repository
node /absolute/path/to/edw-doc-plugin/scripts/cli.mjs setup-status --root /absolute/path/to/repository
```

For a custom vault, use `setup --root /absolute/path/to/repository --vault-name project-docs`. Ordinary CLI operations and the MCP broker use the installed vault name when no explicit override is supplied. CLI `--vault-name` remains an explicit override; a host `EDW_DOC_NAME` conflicting with installed setup is rejected so hooks and the broker do not silently target different vaults. Re-running setup for a custom vault must use the same `--vault-name`. Changing the installed name requires removing the integration and setting it up again; setup does not migrate vault content.

Fresh setup adds `.claude/edw-doc/instructions.md`, `config.json`, and an ownership manifest. An existing owned `.claude/doc-vault/` integration is reused in place, including its legacy instruction references and rule adapter. Re-running setup updates unchanged owned instruction text to `/edw-doc:*`; it does not move the integration or create a duplicate. Edited files and references remain preserved and are reported. It chooses an entry point conservatively:

| Existing local structure | Setup behavior |
|---|---|
| A single Claude entry point already imports the owned instructions, directly or through a bounded repository-local import chain | Reuse the reference without editing it or adding another adapter, including when that entry point is tracked. |
| Exactly one `CLAUDE.md` or `.claude/CLAUDE.md`, untracked and already ignored | Append a marked relative import, preserving surrounding bytes. Reuse an identical import already present. |
| Tracked or unignored Claude instructions | Preserve them; add `.claude/rules/edw-doc.md` instead. |
| Only `AGENTS.md`, a custom `AGENT.md`, multiple possible entry points, or an existing `CLAUDE.local.md` | Preserve them and use the rule adapter; automatic loading and precedence cannot be verified. |
| No detected entry point | Create a minimal root `CLAUDE.md`, and add its exact ignore rule. |

The rule adapter tells the agent to read the exact installed instructions file for EDW Doc work: `.claude/edw-doc/instructions.md` for fresh setups, or the existing `.claude/doc-vault/instructions.md` for upgraded setups. It does not depend on `@` import expansion inside rule files. Imports shown inside code examples or comments are not treated as active. Unsupported encodings or unclosed Markdown fences/comments use the adapter, preserving the original bytes. Existing `AGENTS.md` files are never modified by this installer. It never creates `CLAUDE.local.md`, changes global or ancestor instruction files, edits Claude settings, or registers hooks in the repository. Hook logic is packaged with the plugin.

Setup creates a missing `.claude` directory or adds only its owned files to an existing one. It creates a missing `.gitignore` or appends the required vault and `.claude` rules; a newly created root `CLAUDE.md` also gets an exact ignore rule. It never untracks files. If an unowned file already occupies a required integration path, setup reports a namespace collision and preserves it instead of overwriting it. Unsafe paths, inaccessible Git metadata, or conflicting vault configuration stop setup.

Repeated setup recognizes ownership and avoids duplicate imports. Unchanged owned files can be updated; edited or missing content is preserved and reported. Existing configuration is preserved, including `maintenance.enabled: false`. Missing, edited, tracked, or inconsistent integration content can disable maintenance. Check `setup-status` warnings before relying on it. Its `activation: unverified` result is deliberate: host version, managed settings, global instructions, and enabled plugins can affect whether instructions load. The command cannot prove host activation.

After setup, load the plugin and run `/edw-doc:build` if needed. Hooks refresh only an existing owned vault; setup and session startup never silently initialize one.

### Automatic maintenance

With local maintenance enabled, `SessionStart`, `UserPromptSubmit`, `PostToolUse`, and `Stop` can reconcile source state. Plan-mode events and subagent events do not write. Broker tool calls are skipped by `PostToolUse`; other tool events are throttled to avoid repeated scans within two seconds. Source changes made outside Claude, including pulls or branch switches, are caught at the next supported event, not immediately while idle.

Static refresh updates maps and invalidates affected explanations. The finish hook displays one nonblocking `/edw-doc:sync` reminder for pending work on a snapshot. It records the notice to suppress repeated stop reminders. It does not start a model run, force completion, or prevent the coding task from ending. Run `/edw-doc:standards` and `/edw-doc:review` separately when those results need updating.

There is no always-on AI worker, auto-started watcher, or installed Git hook. Session hooks do not run when Claude Code is closed. The existing optional CLI `watch` command performs static refresh only while its process runs.

### Removing local integration

```sh
node /absolute/path/to/edw-doc-plugin/scripts/cli.mjs uninstall --root /absolute/path/to/repository
```

This removes the local integration, not the installed plugin package or the generated vault. It removes only unchanged owned files and exact owned blocks, preserving surrounding instructions, edited content, ignore entries, and directories. A pre-existing import reused at setup is not owned and is not removed. Edited content may remain with an ownership record marked removed; automatic maintenance is disabled even if an edited configuration file remains. Review that preserved content before reinstalling. Tracked or unsafe integration paths prevent removal rather than being forcibly changed.

See [the business overview](business-overview.md) for capabilities and preservation rules, and [the permission boundary](security.md) for setup versus analysis scope.

## Marketplace distribution

The package is a single-plugin repository. Its marketplace entry uses `source: "./"`, meaning the plugin lives at that marketplace repository's root. Do not change this to a nested path unless the distribution layout actually changes.

For a local marketplace checkout:

```text
/plugin marketplace add /absolute/path/to/edw-doc-plugin
/plugin install edw-doc@edw-doc-tools
```

For a hosted distribution, replace the local marketplace location with your approved repository location. Public and private hosting are distribution choices; neither changes the vault's local output boundary. Private hosting requires the user's existing approved repository access. The plugin does not provision that access.

The current repository URL remains `https://github.com/tsarukoles/doc-vault.git`. Version 0.2.0 renames the plugin and catalog, not the GitHub repository or your existing checkout folder. Example paths use `edw-doc-plugin` to distinguish the plugin checkout from a generated `edw-doc/` vault.

Choose a user-level or other appropriately approved installation scope when source repositories must remain unchanged. Do not add project settings to a target repository merely to install this plugin; that is outside its documented source-write permission.

## Updates

Keep the plugin manifest and marketplace entry versions consistent when releasing changes. Increment the version for a new distribution; replacing files under an unchanged cached version is not a reliable update process. Users can refresh the marketplace and update the installed plugin through the host's plugin manager.

### Upgrade from the old plugin name

Version 0.2.0 replaces `doc-vault@doc-vault-tools` with `edw-doc@edw-doc-tools` and `/doc-vault:*` with `/edw-doc:*`. Close older Claude sessions, pull the updated checkout, and use these terminal commands for a user-scope installation:

```sh
claude plugin disable doc-vault@doc-vault-tools --scope user
claude plugin marketplace add /absolute/path/to/edw-doc-plugin
claude plugin install edw-doc@edw-doc-tools --scope user
claude plugin list
```

Use the original scope if different. If the new catalog is already registered, run `claude plugin marketplace update edw-doc-tools` and continue. Keep the old plugin disabled to avoid duplicate hooks. A normal update of the old plugin identity is insufficient for this rename. For temporary `--plugin-dir` loading, restart against the updated checkout instead.

For each project with local integration, repeat `setup` and `setup-status` with the same vault name. Existing `.claude/doc-vault/` integrations are updated in place when their owned files are unchanged; inspect warnings about preserved edits. Existing generated `edw-doc/` vaults stay compatible and do not need rebuilding or moving. Start a new Claude session and verify version 0.2.0 with `/edw-doc:status`. See the [team walkthrough](../GET-STARTED.md#upgrading-from-doc-vault-013-or-earlier).

Compatibility does not mean earlier explanations remain current. The version upgrade can mark them stale and queue fresh analysis. Run `/edw-doc:sync`, inspect remaining work, and reassess standards or review as needed. Earlier prose is archived and personal annotations are preserved.

New configuration should use `EDW_DOC_ROOT` and `EDW_DOC_NAME`. Legacy `DOC_VAULT_ROOT` and `DOC_VAULT_NAME` remain accepted as compatibility aliases. Do not configure conflicting values under the two names.

### Later updates

Auto-update is a host/marketplace setting, not a background feature of this runtime. Enable it only through the approved host configuration. A version update does not automatically re-analyze every existing vault; run sync or build when analysis behavior changes. Start a fresh session so updated hooks, tools, and skills load. For an installed local integration, re-run `setup` with the same vault name to update unchanged owned instructions. See [the 0.1.2 release notes](release-v0.1.2.md).

### Moving a 0.1.0 vault

Version 0.1.1 changed the default output folder to `edw-doc/`; version 0.2.0 also renames the plugin and command namespace to `edw-doc`. A previous `doc-vault/` folder is not silently moved or merged. From the plugin checkout, migrate it explicitly:

```sh
node scripts/cli.mjs migrate --root /absolute/path/to/repository --from doc-vault --to edw-doc
```

Use an absolute path to the CLI when running elsewhere. Check the reported source and destination before continuing with `/edw-doc:sync`; follow with `/edw-doc:standards` to assess current rules. The migration preserves annotations and source files. Do not manually combine generated state from two vaults. If you intentionally retain the old location, configure the broker's `EDW_DOC_NAME=doc-vault`; CLI operations can use `--vault-name doc-vault`. A configured custom location should be used consistently by the broker and CLI.

Ignoring `.claude/` affects untracked settings and session files. It does not remove previously committed files from tracking. Projects that intentionally share `.claude` settings must consider that tracking separately; the plugin never edits the settings or stages/removes them.

## Verify the installation

The available skills should include build, sync, audit, onboard, ask, status, review, and standards. The four agents should expose only their named broker tools. The standards specialist has rule/assessment operations but no scan or general publication operation. If the MCP server does not start, verify Node availability and the plugin path; do not work around the failure by granting broad filesystem or shell tools to the analysis agent.

Check reported source and vault roots before generating content. `EDW_DOC_ROOT`, if explicitly configured, selects the target; otherwise the broker resolves the active Git root or working directory. The repository's source files should remain unchanged after a build, apart from the documented `.gitignore` entry. Optional setup changes are limited to its separately documented local integration paths. Check the host's loaded instructions and hook behavior in addition to the CLI's `setup-status` result.

Local runtime tests are separate from real host validation. This package was developed without an available Claude Code installation, so plugin loading, tool-name registration, forked-agent dispatch, and provider integration still require a smoke test in the intended host. Do not interpret the unit tests as that validation.

## Host documentation

The integration follows Claude Code's documented [skill execution](https://code.claude.com/docs/en/skills), [plugin subagent definitions](https://code.claude.com/docs/en/sub-agents), [instruction loading](https://code.claude.com/docs/en/memory), [hook events](https://code.claude.com/docs/en/hooks), and [marketplace distribution](https://code.claude.com/docs/en/plugin-marketplaces). Broker tool identifiers follow the [official plugin MCP naming guidance](https://github.com/anthropics/claude-code/blob/main/plugins/plugin-dev/skills/mcp-integration/references/tool-usage.md). Check these references when updating the supported host version; a local package check cannot establish host compatibility.
