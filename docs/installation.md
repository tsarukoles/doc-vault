# Installation and updates

## Local development or evaluation

Use Node.js 20 or later and Git when documenting a Git repository. There is no dependency installation step for the local runtime. Configure the host's approved model/provider independently; Doc Vault does not create credentials or make direct model-provider calls.

From the repository to document:

```sh
claude --plugin-dir /absolute/path/to/doc-plugin
```

Run `/doc-vault:status` to inspect the configured repository. Run `/doc-vault:build` to create the ignored `edw-doc/` vault. Build/sync creates a missing root `.gitignore` or appends the configured vault rule and `/.claude/`; existing content is preserved. The default rules are `/edw-doc/` and `/.claude/`. Already tracked `.claude` files are reported without changing tracking. All other generated files stay under the vault. The plugin's read-only session-start hook reports status but never creates or refreshes the vault or ignore rules.

After build, run `/doc-vault:standards` for the dedicated standards assessment, then `/doc-vault:review` for a separate source-evidence review. Static baseline notes and initial standards candidates are not completed AI analysis.

The examples use POSIX-style absolute paths. On Windows, quote an absolute path such as `"C:\path\to\doc-plugin"`. The plugin location and target repository are different paths. Do not run a target scan against the installation directory by mistake.

## Marketplace distribution

The package is a single-plugin repository. Its marketplace entry uses `source: "./"`, meaning the plugin lives at that marketplace repository's root. Do not change this to a nested path unless the distribution layout actually changes.

For a local marketplace checkout:

```text
/plugin marketplace add /absolute/path/to/doc-plugin
/plugin install doc-vault@doc-vault-tools
```

For a hosted distribution, replace the local marketplace location with your approved repository location. Public and private hosting are distribution choices; neither changes the vault's local output boundary. Private hosting requires the user's existing approved repository access. The plugin does not provision that access.

Choose a user-level or other appropriately approved installation scope when source repositories must remain unchanged. Do not add project settings to a target repository merely to install this plugin; that is outside its documented source-write permission.

## Updates

Keep the plugin manifest and marketplace entry versions consistent when releasing changes. Increment the version for a new distribution; replacing files under an unchanged cached version is not a reliable update process. Users can refresh the marketplace and update the installed plugin through the host's plugin manager.

Auto-update is a host/marketplace setting, not a background feature of this runtime. Enable it only through the approved host configuration. A version update does not automatically re-analyze every existing vault; run sync or build when analysis behavior changes.

### Moving a 0.1.0 vault

Version 0.1.1 uses `edw-doc/` by default. The plugin and command namespace remain `doc-vault`. A previous `doc-vault/` folder is not silently moved or merged. From the plugin checkout, migrate it explicitly:

```sh
node scripts/cli.mjs migrate --root /absolute/path/to/repository --from doc-vault --to edw-doc
```

Use an absolute path to the CLI when running elsewhere. Check the reported source and destination before continuing with `/doc-vault:sync`; follow with `/doc-vault:standards` to assess current rules. The migration preserves annotations and source files. Do not manually combine generated state from two vaults. If you intentionally retain the old location, configure the broker's `DOC_VAULT_NAME=doc-vault`; CLI operations can use `--vault-name doc-vault`. A configured custom location should be used consistently by the broker and CLI.

Ignoring `.claude/` affects untracked settings and session files. It does not remove previously committed files from tracking. Projects that intentionally share `.claude` settings must consider that tracking separately; the plugin never edits the settings or stages/removes them.

## Verify the installation

The available skills should include build, sync, audit, onboard, ask, status, review, and standards. The four agents should expose only their named broker tools. The standards specialist has rule/assessment operations but no scan or general publication operation. If the MCP server does not start, verify Node availability and the plugin path; do not work around the failure by granting broad filesystem or shell tools to the analysis agent.

Check reported source and vault roots before generating content. `DOC_VAULT_ROOT`, if explicitly configured, selects the target; otherwise the broker resolves the active Git root or working directory. The repository's source files should remain unchanged after a build, apart from the documented `.gitignore` entry.

Local runtime tests are separate from real host validation. This package was developed without an available Claude Code installation, so plugin loading, tool-name registration, forked-agent dispatch, and provider integration still require a smoke test in the intended host. Do not interpret the unit tests as that validation.

## Host documentation

The integration follows Claude Code's documented [skill execution](https://code.claude.com/docs/en/skills), [plugin subagent definitions](https://code.claude.com/docs/en/sub-agents), and [marketplace distribution](https://code.claude.com/docs/en/plugin-marketplaces). Broker tool identifiers follow the [official plugin MCP naming guidance](https://github.com/anthropics/claude-code/blob/main/plugins/plugin-dev/skills/mcp-integration/references/tool-usage.md). Check these references when updating the supported host version; a local package check cannot establish host compatibility.
