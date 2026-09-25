# Installation and updates

## Local development or evaluation

Use Node.js 20 or later, Claude Code CLI 2.1.199 or later, and Git when documenting a Git repository. Version 0.2.1 adds automatic project integration to approved build and sync scans, under the command's existing approval; see [run approval](run-approval.md). There is no dependency installation step for the local runtime. Configure the host's approved model/provider independently; EDW Doc does not create credentials or make direct model-provider calls.

From the repository to document:

```sh
claude --plugin-dir /absolute/path/to/edw-doc-plugin
```

Run `/edw-doc:status` to inspect the configured repository. Run `/edw-doc:build` to create the ignored `edw-doc/` vault and project integration. Approved build and sync scans invoke setup under the same command approval and report the integration result. They create or append the root `.gitignore` for the configured vault, `/.claude/`, and a newly created root `/CLAUDE.md`, preserving existing content and verifying the rules. Already tracked files remain tracked. Other analysis commands and plain static CLI scans do not install integration. Without installed integration, session startup only reports status and never initializes it.

After build, run `/edw-doc:standards` for the dedicated standards assessment, then `/edw-doc:review` for a separate source-evidence review. Static baseline notes and initial standards candidates are not completed AI analysis.

The examples use POSIX-style absolute paths. On Windows, quote an absolute path such as `"C:\path\to\edw-doc-plugin"`. The plugin location and target repository are different paths. Do not run a target scan against the installation directory by mistake.

## Project integration

Approved `/edw-doc:build` and `/edw-doc:sync` scans perform setup automatically. Plugin loading, other analysis commands, hooks, and plain static CLI scans do not install integration. Setup requires an inspectable Git repository root; non-Git builds can still generate a vault and report integration as skipped. Setup does not grant native filesystem or shell tools to agents. The explicit operator CLI remains available for setup, inspection, and repair without AI analysis:

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
| Multiple Claude entry points, or an existing Claude entry point combined with ambiguous instruction structure | Preserve them and use the rule adapter; automatic loading and precedence cannot be verified. |
| Neither root `CLAUDE.md` nor `.claude/CLAUDE.md` exists, including projects with only `AGENTS.md`, custom `AGENT.md`, or `CLAUDE.local.md` | Preserve those files, create a minimal root `CLAUDE.md`, and add its exact ignore rule. |

The rule adapter tells the agent to read the exact installed instructions file for EDW Doc work: `.claude/edw-doc/instructions.md` for fresh setups, or the existing `.claude/doc-vault/instructions.md` for upgraded setups. It does not depend on `@` import expansion inside rule files. Imports shown inside code examples or comments are not treated as active. Unsupported encodings or unclosed Markdown fences/comments use the adapter, preserving the original bytes. Existing `AGENTS.md` files are never modified. Setup never creates `CLAUDE.local.md`, changes global or ancestor instructions, edits Claude settings, or registers hooks in the repository. Existing `.claude` scripts, agents, settings, and hooks remain intact. Runtime scripts and hook logic stay packaged with the plugin; no project copy is required.

Setup creates a missing `.claude` directory or adds only its owned files to an existing one. It creates a missing `.gitignore` or appends the required vault and `.claude` rules; a newly created root `CLAUDE.md` also gets an exact ignore rule. It never untracks files. If an unowned file already occupies a required integration path, setup reports a namespace collision and preserves it instead of overwriting it. Unsafe paths, inaccessible Git metadata, or conflicting vault configuration stop setup.

Repeated setup recognizes ownership and avoids duplicate imports. Unchanged owned files can be updated, and explicit setup can safely repair missing owned files. Edited or conflicting content remains preserved and reported. Existing configuration is preserved, including `maintenance.enabled: false`; a missing configuration is restored with maintenance disabled. Missing, edited, tracked, or inconsistent integration content can disable maintenance. Check the build/sync integration result or `setup-status` warnings before relying on it. Its `activation: unverified` result is deliberate: host version, managed settings, global instructions, and enabled plugins can affect whether instructions load. The command cannot prove host activation.

An absent but still tracked `CLAUDE.md` is treated as an intentional deletion and preserved; setup uses a local rule adapter instead. If an older installation has only an unchanged owned rule adapter and neither supported Claude entry point exists, setup replaces that adapter with a root `CLAUDE.md`, keeping the existing integration namespace and avoiding duplicate activation. Edited adapters remain intact with a warning. A deleted, previously reused user instruction file is never reconstructed from guesses: setup creates a safe new reference without claiming to restore the missing user text.

Standalone setup does not build a vault. After using it, load the plugin and run `/edw-doc:build` if needed. Hooks refresh only an existing owned vault; they never install integration or silently initialize a vault.

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

For the shared toolkit, place the complete plugin in `edw-ai-toolkit/plugins/edw-doc/` and the marketplace catalog at `edw-ai-toolkit/.claude-plugin/marketplace.json`. The catalog's name remains `edw-doc-tools`. Preserve other entries and add this plugin entry:

```json
{
  "name": "edw-doc",
  "source": "./plugins/edw-doc"
}
```

The source path is relative to the toolkit root. If the actual folder remains `plugins/doc-vault`, use `./plugins/doc-vault` instead; the installed plugin name is still `edw-doc`. Copy the complete package, including its own `package.json`, hidden plugin files, `policies`, `packs`, `schemas`, `templates`, and `workflows`; root toolkit folders do not replace them. Exclude the original checkout's `.git` directory. See the [team guide](../GET-STARTED.md#2-prepare-the-toolkit-catalog) for a complete catalog and layout.

From the toolkit root, in a terminal:

```sh
claude plugin marketplace add ./
claude plugin install edw-doc@edw-doc-tools --scope user
```

Include the slash in `./`; a bare `.` may be rejected. Register the toolkit root, while direct `--plugin-dir` loading points to its `plugins/edw-doc` folder. The original standalone catalog uses `source: "./"` because its plugin is at the catalog repository's root; it can remain in the copied package but is not the catalog registered for team installation.

For a hosted distribution, replace the local marketplace location with your approved repository location. Public and private hosting are distribution choices; neither changes the vault's local output boundary. Private hosting requires the user's existing approved repository access. The plugin does not provision that access.

The original standalone repository URL remains `https://github.com/tsarukoles/doc-vault.git`; it is not the team's toolkit URL. Use the actual approved toolkit repository location. The CLI paths elsewhere on this page refer to the plugin folder; in a toolkit checkout, replace `/absolute/path/to/edw-doc-plugin` with `/absolute/path/to/edw-ai-toolkit/plugins/edw-doc`.

Choose a user-level or other appropriately approved installation scope when source repositories must remain unchanged. Do not add project settings to a target repository merely to install this plugin; that is outside its documented source-write permission.

## Updates

Keep the plugin manifest and marketplace entry versions consistent when releasing changes. Increment the version for a new distribution; replacing files under an unchanged cached version is not a reliable update process. Users can refresh the marketplace and update the installed plugin through the host's plugin manager.

### Upgrade from the old plugin name

Version 0.2.0 replaces `doc-vault@doc-vault-tools` with `edw-doc@edw-doc-tools` and `/doc-vault:*` with `/edw-doc:*`. Close older Claude sessions, pull the updated checkout, and use these terminal commands for a user-scope installation:

```sh
claude plugin disable doc-vault@doc-vault-tools --scope user
claude plugin marketplace add /absolute/path/to/edw-ai-toolkit
claude plugin install edw-doc@edw-doc-tools --scope user
claude plugin list
```

Use the original scope if different. If the new catalog is already registered, run `claude plugin marketplace update edw-doc-tools` and continue. Keep the old plugin disabled to avoid duplicate hooks. A normal update of the old plugin identity is insufficient for this rename. For temporary `--plugin-dir` loading, restart against the updated checkout instead.

Start a new Claude session and verify version 0.2.1 with `/edw-doc:status`, then run `/edw-doc:sync` to ensure project integration and refresh analysis. Explicit `setup` and `setup-status` remain available for inspection or repair, using the same vault name. Existing `.claude/doc-vault/` integrations are reused in place; inspect warnings about preserved edits. Existing generated `edw-doc/` vaults stay compatible and need no move. See the [team walkthrough](../GET-STARTED.md#upgrading-from-doc-vault-013-or-earlier).

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

Check reported source and vault roots before generating content. `EDW_DOC_ROOT`, if explicitly configured, selects the target; otherwise the broker resolves the active Git root or working directory. Application source must remain unchanged. Build and sync may change only the managed vault, documented owned integration paths and instruction references, and exact ignore entries. Check their integration result, the host's loaded instructions and hook behavior, and the CLI's `setup-status` result.

Local runtime tests are separate from real host validation. This package was developed without an available Claude Code installation, so plugin loading, tool-name registration, forked-agent dispatch, and provider integration still require a smoke test in the intended host. Do not interpret the unit tests as that validation.

## Host documentation

The integration follows Claude Code's documented [skill execution](https://code.claude.com/docs/en/skills), [plugin subagent definitions](https://code.claude.com/docs/en/sub-agents), [instruction loading](https://code.claude.com/docs/en/memory), [hook events](https://code.claude.com/docs/en/hooks), and [marketplace distribution](https://code.claude.com/docs/en/plugin-marketplaces). Broker tool identifiers follow the [official plugin MCP naming guidance](https://github.com/anthropics/claude-code/blob/main/plugins/plugin-dev/skills/mcp-integration/references/tool-usage.md). Check these references when updating the supported host version; a local package check cannot establish host compatibility.
