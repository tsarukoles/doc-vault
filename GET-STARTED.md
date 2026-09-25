# Get started with EDW Doc

Team guide for **EDW Doc 0.2.1** (previously Doc Vault), installed from the shared **edw-ai-toolkit** repository.

EDW Doc creates local Markdown notes explaining a project's files, components, flows, and standards. It uses the model/provider already configured in your Claude session, including an approved Bedrock connection. There is **no plugin build step and no `npm install` step**.

## 1. Check your tools and folders

You need Node.js 20 or later, Git, Claude Code CLI 2.1.199 or later, and a working Claude session using your team's approved model/provider. Run in your terminal:

```powershell
node --version
git --version
claude --version
```

These Windows examples use three distinct locations. Replace them with your actual paths; on macOS/Linux, use the equivalent absolute paths.

| Example location | What it contains |
|---|---|
| `C:\tools\edw-ai-toolkit` | Shared toolkit repository and root marketplace catalog. |
| `C:\tools\edw-ai-toolkit\plugins\edw-doc` | Complete EDW Doc plugin package. |
| `C:\projects\data-control-framework` | Project you want documented. |

Clone your team's actual `edw-ai-toolkit` Git repository, or pull your existing checkout. Your team supplies that repository URL. The older `tsarukoles/doc-vault` repository is not the toolkit URL.

## 2. Prepare the toolkit catalog

This section is for the person maintaining the toolkit. Teammates can skip to installation once this structure is committed and pulled.

```text
edw-ai-toolkit/
├── .claude-plugin/
│   └── marketplace.json
├── agents/
├── skills/
├── standards/
├── workflows/
└── plugins/
    └── edw-doc/
        ├── .claude-plugin/plugin.json
        ├── .mcp.json
        ├── package.json
        ├── agents/
        ├── skills/
        ├── hooks/
        ├── scripts/
        ├── src/
        ├── policies/
        ├── packs/
        ├── schemas/
        ├── templates/
        ├── workflows/
        ├── tests/
        ├── fixtures/
        ├── docs/
        ├── README.md
        ├── GET-STARTED.md
        └── BUSINESS-REQUIREMENTS.md
```

Copy the **whole plugin package**, including hidden plugin files and supporting folders, into `plugins/edw-doc`. Exclude the original checkout's `.git` directory and local generated vaults. The toolkit's root `agents`, `skills`, or `workflows` do not replace the plugin's own folders. Scripts and hooks resolve paths from the installed plugin location.

The installable catalog belongs at **`edw-ai-toolkit/.claude-plugin/marketplace.json`**. If it exists, preserve its other entries and add or update only EDW Doc. A minimal complete catalog is:

```json
{
  "name": "edw-doc-tools",
  "owner": { "name": "EDW toolkit maintainers" },
  "plugins": [
    {
      "name": "edw-doc",
      "source": "./plugins/edw-doc",
      "description": "Local repository documentation and standards analysis."
    }
  ]
}
```

Use your team's actual owner name. `source` is relative to the **toolkit root**, not the `.claude-plugin` directory. If the actual folder is still `plugins/doc-vault`, use `"source": "./plugins/doc-vault"` and that folder in every plugin path below. The installed plugin name stays `edw-doc`.

The original standalone package can retain its own catalog; team installation registers the toolkit root catalog. Keep the plugin manifest version current when distributing changes. If the root catalog specifies a plugin version, keep it consistent with that manifest.

Validate from the plugin directory:

```powershell
cd "C:\tools\edw-ai-toolkit\plugins\edw-doc"
npm run check
```

This validates the package; it does not create project documentation or call a model.

## 3. Install on each teammate's machine

Run in your **terminal**, from the toolkit root:

```powershell
cd "C:\tools\edw-ai-toolkit"
claude plugin marketplace add ./
claude plugin install edw-doc@edw-doc-tools --scope user
claude plugin list
```

Use **`./`**, including the slash, for a relative marketplace path. The name after `@` comes from the catalog's `name`: **`edw-doc-tools`**, even though the repository folder is `edw-ai-toolkit`.

If the catalog is already registered at the intended toolkit location, refresh it with `claude plugin marketplace update edw-doc-tools`. If it still points to an older standalone checkout, remove that old marketplace registration and register the toolkit root before installing. Keep the toolkit checkout available for later updates.

Check that `edw-doc` is enabled and shows version **0.2.1** for this release. If you previously installed `doc-vault`, follow the [one-time rename steps](#upgrading-from-doc-vault-013-or-earlier). Installing the plugin alone does not create files in every project; the first approved build or sync performs project integration.

### Alternative: try without persistent installation

From the target project, launch:

```powershell
cd "C:\projects\data-control-framework"
claude --plugin-dir "C:\tools\edw-ai-toolkit\plugins\edw-doc"
```

Repeat this launch when you want the plugin in a session. This path is the **plugin folder**, whereas marketplace registration uses the **toolkit root**. With persistent installation, launch using plain `claude`.

## 4. Build the project's first vault

Close older Claude sessions. Start a new session in the project you want documented:

```powershell
cd "C:\projects\data-control-framework"
claude
```

Inside **Claude**, run `/edw-doc:status`. Verify the target root and plugin version. A missing vault is expected on first use. If the root is wrong, relaunch from the correct project; `EDW_DOC_ROOT`, if configured, can override the target. Legacy `DOC_VAULT_ROOT` and `DOC_VAULT_NAME` remain aliases; do not configure conflicting old and new values.

Run these **one at a time**, letting each finish:

```text
/edw-doc:build
/edw-doc:standards
/edw-doc:review
/edw-doc:status
```

| Command | Result |
|---|---|
| `build` | Sets up project integration, creates the vault, maps sources, and writes explanations from inspected evidence. |
| `standards` | Finds evidenced requirements and conventions and records assessments. Requires a current build or sync. |
| `review` | Checks published claims against source in a separate context. Its default scope is a declared sample, not every note. |
| `status` | Reports freshness, analysis coverage, standards coverage, and remaining work. |

### What build and sync create

Approved build and sync scans perform setup automatically in an inspectable Git repository root. No separate setup command is required before normal first use. Non-Git folders can still receive a vault, but integration is skipped with an explicit reason; inspect the command's result.

For a project with no Claude instructions, the expected structure is:

```text
data-control-framework/
├── .gitignore
├── CLAUDE.md
├── .claude/
│   └── edw-doc/
│       ├── instructions.md
│       ├── config.json
│       └── manifest.json
└── edw-doc/
```

- Missing `.claude` is created. Existing settings, rules, agents, scripts, and hooks remain intact; only owned integration files are added.
- If neither root `CLAUDE.md` nor `.claude/CLAUDE.md` exists, setup creates root **`CLAUDE.md`**. Existing `AGENTS.md` and `CLAUDE.local.md` are preserved.
- Existing Claude instructions keep their contents. A suitable ignored file receives a marked import; otherwise, `.claude/rules/edw-doc.md` supplies the reference. An existing `.claude/CLAUDE.md` can be reused without creating another root copy.
- The vault, `.claude/`, and a newly created root `CLAUDE.md` get exact root ignore rules. Already tracked files remain tracked.
- Runtime scripts stay inside the installed plugin. No duplicate scripts or Git hooks are copied into the target project.
- Existing owned `.claude/doc-vault/` integration is reused in place. User edits, configuration, and an existing disabled-maintenance preference remain intact.

Read the integration result and warnings. Conflicting files are preserved and reported. `activation: unverified` means setup cannot prove Claude loaded the instructions; inspect them in your real session. See [integration details](docs/installation.md#project-integration).

### Permissions and coverage

Each command is designed for **one initial approval**, reused across its batches. Build and sync approval includes the narrow integration additions above. Source code stays read-only; writes are limited to managed documentation, owned integration files, supported instruction references, and exact ignore rules. No project tests or scripts are executed.

Initial workspace/server trust and organization policies can still add prompts. The actual one-prompt flow needs verification in your team's CLI/provider environment; see the [host checklist](docs/run-approval.md#update-and-verify). Do not disable permissions globally.

Version 0.2.1 **does not guarantee a complete AI sweep in one run**. Read the completion report and check remaining work:

- A current inventory does not mean every file has an AI explanation.
- **Not assessed** means standards work remains; **stale** means a previous result needs checking again.
- **Unknown** means inspected evidence was insufficient; it is not a pass.
- Excluded and unsupported files remain coverage limits.

Continue remaining work explicitly, for example:

```text
/edw-doc:standards Continue the remaining unassessed files. Report completed and pending scope.
```

AI review is not human approval, executed testing, or compliance certification.

## 5. Read and use the documentation

Open `edw-doc/index.md` in your editor, or open `edw-doc` as an Obsidian vault.

| Vault location | Purpose |
|---|---|
| `index.md` | Main navigation. |
| `analysis-index.md` | AI explanations, coverage, and review status. |
| `file-map.md` | Source files and their notes. |
| `onboarding/` and `flows/` | Reading paths and process walkthroughs. |
| `standards/` | Rules, assessments, and source links. |
| `annotations/` | Your personal notes. |

Some folders appear after the corresponding notes are published. Put personal additions in `annotations/`; direct edits to managed notes can stop updates to preserve your changes. Do not edit `.system/` state manually.

Useful commands inside Claude:

```text
/edw-doc:ask Where are inputs validated, and how are failures handled?
/edw-doc:onboard Explain the main execution path for a new engineer.
/edw-doc:audit Inspect the test structure and report evidence-backed findings.
/edw-doc:sync
/edw-doc:status
```

`ask` reads and answers; `onboard` saves a guide. Findings are advisory and do not modify source.

## 6. After edits, a pull, or a branch switch

Run `/edw-doc:sync`, then `/edw-doc:status`. Sync compares the current checkout with stored state, detects additions, edits, deletions, and supported renames, and updates affected explanations. Uncertain renames may be treated as removal plus addition. Run standards and review separately when their results are affected.

There is **one local vault per checkout**, not a separate saved vault for each branch. Switching branches does not restore an earlier branch's documentation. The next refresh reconciles the current files; older notes may become stale or retire. Sync before relying on current-branch documentation.

When local maintenance is enabled, Claude events can refresh static maps and show a nonblocking reminder. They do not run an automatic AI sweep or force synchronization. While Claude is closed, pulls and branch switches do not trigger this plugin: no Git hooks or always-running model worker are installed.

Without a model connection, inspect local status from your terminal:

```powershell
node "C:\tools\edw-ai-toolkit\plugins\edw-doc\scripts\cli.mjs" status --root "C:\projects\data-control-framework"
```

The terminal `scan`, `sync`, and optional `watch` utilities are static only and do not install project integration. Use `/edw-doc:sync` in Claude for AI explanations and automatic integration.

## 7. Update the installed plugin

Close older Claude sessions. In your terminal:

```powershell
cd "C:\tools\edw-ai-toolkit"
git pull
cd "C:\tools\edw-ai-toolkit\plugins\edw-doc"
npm run check
claude plugin marketplace update edw-doc-tools
claude plugin update edw-doc@edw-doc-tools --scope user
claude plugin list
```

Use the original installation scope if it differs. For temporary `--plugin-dir` use, skip marketplace commands and restart against the updated plugin folder. There is no dependency reinstall or compilation step.

Start Claude again in the target project, run `/edw-doc:status` to verify the loaded version, then `/edw-doc:sync`. Approved sync also ensures project integration and reports preserved edits or conflicts. Pulling toolkit code alone does not refresh cached installations or existing AI explanations. Version changes can mark earlier explanations stale; previous prose is archived and personal annotations are preserved.

### Upgrading from Doc Vault 0.1.3 or earlier

Disable the older plugin if still installed, so duplicate hooks do not run:

```powershell
claude plugin disable doc-vault@doc-vault-tools --scope user
```

Then register the toolkit catalog and install `edw-doc@edw-doc-tools` using section 3. If the old plugin was already removed, skip disabling it. A normal update of the old plugin identity does not install the renamed one.

Restart Claude and run `/edw-doc:sync`. Existing owned `.claude/doc-vault/` integration is reused; existing `edw-doc/` documentation and annotations need no move. Commands now use `/edw-doc:*`. A much older generated `doc-vault/` vault requires the separate [explicit vault migration](docs/installation.md#moving-a-010-vault).

## 8. Advanced setup, inspection, and repair

Use the following only to inspect or set up integration without running AI analysis, or to repair missing previously owned files:

```powershell
node "C:\tools\edw-ai-toolkit\plugins\edw-doc\scripts\cli.mjs" setup --root "C:\projects\data-control-framework"
node "C:\tools\edw-ai-toolkit\plugins\edw-doc\scripts\cli.mjs" setup-status --root "C:\projects\data-control-framework"
```

Standalone setup does not build the vault. It preserves edited files and existing configuration, including `maintenance.enabled: false`; a missing configuration is repaired with maintenance disabled. Review its warnings. To select a custom vault before first use, append `--vault-name project-docs` and keep the same name on later explicit setup calls. Do not manually rename or merge generated vaults.

Each teammate keeps local documentation and integration in each target checkout. Normal Git push/pull does not share the ignored vault, assessments, or annotations. Source evidence sent for analysis follows the configured Claude provider's data policies; local storage does not imply local inference.

## Troubleshooting

| Problem | Check |
|---|---|
| Invalid marketplace source format | Run from toolkit root with `claude plugin marketplace add ./`; include the slash. |
| Plugin not found in the catalog | Root catalog name must be `edw-doc-tools`; plugin name `edw-doc`; source must match the actual `./plugins/edw-doc` or `./plugins/doc-vault` folder. |
| Slash commands are missing or old | Inspect `claude plugin list`, marketplace location, enabled state, and version. Update the installed copy and fully restart Claude. |
| Build created no `.claude` | Verify version 0.2.1 and target root, then inspect the integration result. Earlier builds and static CLI scans do not perform setup; non-Git targets report a skip. Check `setup-status` or explicit setup for conflicts. |
| No root `CLAUDE.md` | Check for an existing `.claude/CLAUDE.md`, which can be reused. A deleted but still tracked root file or an edited existing adapter is preserved; inspect setup warnings. Use the exact uppercase filename. |
| Folder is still visible in the editor | Ignoring does not hide a folder from the explorer. Check Git's actual status as shown below. |
| Extra permission prompts | Check host version, trust, loaded hooks/tools, and organizational policy; see the host approval checklist. |
| Files remain unassessed | Current inventory and completed analysis are separate. Continue remaining scope and recheck status. |
| Manually edited managed note | Preserve your text in an annotation or backup and resolve the reported conflict; do not delete state to force an overwrite. |
| No maintenance reminders | Check integration status, maintenance settings, and whether a vault exists. Hooks require supported events while Claude is active. |

From the **target project's Git root**, verify ignoring:

```powershell
git check-ignore -v --no-index -- edw-doc/
git ls-files -- edw-doc/
git status --short --untracked-files=all -- edw-doc/
```

`/edw-doc/` in that root `.gitignore` matches the root vault. Removing the leading slash broadens the rule to matching folders anywhere below it; it should not be necessary for the default root vault. An ignore match plus empty output from the other two commands means Git ignores it correctly. Tracked files remain tracked; this plugin never untracks them.

See [installation details](docs/installation.md), [vault navigation](docs/vault-layout.md), [standards](docs/standards.md), and [known limits](docs/limitations.md). Host commands follow Claude's [marketplace documentation](https://code.claude.com/docs/en/plugin-marketplaces) and [plugin command reference](https://code.claude.com/docs/en/plugins-reference).
