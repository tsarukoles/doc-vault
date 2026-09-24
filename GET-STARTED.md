# Get started with EDW Doc

Team guide for **EDW Doc 0.2.0** (previously Doc Vault).

EDW Doc helps you understand a codebase. It creates a local folder of Markdown notes explaining files, components, flows, and project standards. You can ask questions, generate an onboarding guide, and refresh documentation after source changes.

There is **no plugin build step and no `npm install` step**. Install or load the plugin, then ask Claude to build the documentation for your project.

## 1. Check your tools

You need:

- **Node.js 20 or later**, available in your terminal.
- **Git** and access to the plugin repository and the project you want to document.
- **Claude Code CLI 2.1.199 or later**.
- A working Claude session using your team's approved model/provider. If your team uses Bedrock, configure Claude for Bedrock first. EDW Doc uses that existing connection; it needs no separate model API key.

Run these in your **terminal**, outside a Claude conversation:

```sh
node --version
git --version
claude --version
```

The examples below use Windows paths. Replace them with your own absolute paths. On macOS/Linux, use paths such as `/Users/you/tools/edw-doc-plugin` and `/Users/you/projects/my-project`; the command names are the same.

Keep these two folders separate:

| Example folder | What it contains |
|---|---|
| `C:\tools\edw-doc-plugin` | This plugin's code and instructions. |
| `C:\projects\my-project` | The project you want EDW Doc to document. |

## 2. Get and install the plugin

If you already cloned and pulled this repository, use that folder and skip cloning again.

If you already installed `doc-vault@doc-vault-tools`, follow [the rename upgrade steps](#upgrading-from-doc-vault-013-or-earlier) instead of treating this as a normal plugin update.

In your **terminal**:

```sh
git clone https://github.com/tsarukoles/doc-vault.git "C:\tools\edw-doc-plugin"
cd "C:\tools\edw-doc-plugin"
npm run check
```

`npm run check` validates the plugin package. It does not build documentation or call a model.

The GitHub repository still uses the name `doc-vault`; it has not been renamed or moved. `edw-doc-plugin` is only the example local checkout folder. Keep using your existing checkout path if it has a different name.

Register this checkout and install the plugin for your user account:

```sh
claude plugin marketplace add "C:\tools\edw-doc-plugin"
claude plugin install edw-doc@edw-doc-tools --scope user
claude plugin list
```

Check that `edw-doc` is installed and enabled, with version **0.2.0** for this release. Keep the plugin checkout in place so you can update it later.

### Alternative: try it without a persistent installation

Instead of the marketplace installation above, start Claude from the project you want documented:

```sh
cd "C:\projects\my-project"
claude --plugin-dir "C:\tools\edw-doc-plugin"
```

Use that launch command each time you want the plugin in a session. For the persistent installation, launch with plain `claude` as shown below.

## 3. Optional: enable local maintenance reminders

Do this once per target project if you want local instructions and maintenance at Claude session checkpoints. The target must be the project's Git repository root.

In your **terminal**:

```sh
node "C:\tools\edw-doc-plugin\scripts\cli.mjs" setup --root "C:\projects\my-project"
node "C:\tools\edw-doc-plugin\scripts\cli.mjs" setup-status --root "C:\projects\my-project"
```

Fresh setup adds owned integration files under `.claude/edw-doc/` and an instruction reference appropriate for the project. Existing owned `.claude/doc-vault/` installations remain in place; repeating setup updates unchanged instructions to `/edw-doc:*`. It preserves existing user instructions and does not edit Claude settings or Git configuration. It may add an ignored `CLAUDE.md` when no instruction entry point exists. See [setup details](docs/installation.md#optional-local-integration).

Setup **does not build the vault**. Continue with the next step. `activation: unverified` means the setup tool cannot prove Claude loaded the instructions; inspect any other warnings and verify them in a real session.

The default vault folder is `edw-doc`. To choose a different name during setup, append `--vault-name project-docs`. Keep using that same name whenever you repeat setup; do not rename an existing vault manually.

## 4. Build your project's first vault

Close any older Claude session. In your **terminal**, start a new one from the target project:

```sh
cd "C:\projects\my-project"
claude
```

If you chose the temporary installation, use the `--plugin-dir` launch command instead.

Inside **Claude**, run:

```text
/edw-doc:status
```

Check the reported repository root and plugin version. A missing vault is expected on the first run. If the root is wrong, stop and relaunch from the correct project; an existing `EDW_DOC_ROOT` environment setting can also override the target. The old `DOC_VAULT_ROOT` and `DOC_VAULT_NAME` environment variables still work as compatibility aliases; use the new `EDW_DOC_ROOT` and `EDW_DOC_NAME` names for new configuration.

Then run these commands **one at a time**, letting each finish:

```text
/edw-doc:build
/edw-doc:standards
/edw-doc:review
/edw-doc:status
```

| Command | What it does |
|---|---|
| `build` | Creates the vault, maps supported files, and writes explanations from inspected source. |
| `standards` | Finds evidenced project requirements and conventions, then records assessments. Requires a current build or sync first. |
| `review` | Checks published claims against source in a separate agent context. Its default scope is a declared sample, not every note. |
| `status` | Reports source freshness, documentation coverage, standards coverage, and remaining work. |

### What to expect from permissions

Each `/edw-doc:*` command is designed to ask for **one initial approval**, then reuse it across that command's batches. Check the repository and requested operation in the approval. Each new command has its own approval; declining it ends that command.

Ordinary analysis keeps source files read-only. It writes managed documentation and records inside the vault and may create or append the exact vault and `/.claude/` entries in the root `.gitignore`. Optional setup has the additional integration-file allowance described above. No tests or project code are executed by these analysis commands.

Initial workspace/server trust and organization policies may still require extra prompts. The one-prompt flow needs verification in your team's CLI/provider environment; see the [approval checklist](docs/run-approval.md#update-and-verify). You do not need to disable permissions globally.

### Check coverage, not just whether a command finished

Version 0.2.0 **does not guarantee a complete AI sweep in one run**. Large repositories can exceed the available context or run budget. Read each command's completion report and use `status` to check what remains.

- **Current inventory** means the file map matches the source snapshot. It does not mean every file has an AI explanation.
- **Not assessed** means standards work remains. **Stale** means a previous result needs checking against newer evidence.
- **Unknown** means the inspected evidence was insufficient for a conclusion; it is not a pass.
- Excluded or unsupported files should remain visible as coverage limits.

Continue the appropriate command for the remaining scope, for example:

```text
/edw-doc:standards Continue the remaining unassessed files. Report what was assessed and what is still pending.
```

AI review is not human approval, executed testing, or compliance certification.

## 5. Read and use the documentation

Open `edw-doc/index.md` in your editor, or open the `edw-doc` folder as an Obsidian vault for wiki-link navigation.

| Location inside the vault | Use it for |
|---|---|
| `index.md` | Main navigation. |
| `analysis-index.md` | AI explanations, coverage, and review status. |
| `file-map.md` | Finding source files and their notes. |
| `onboarding/` | Getting oriented in the project. |
| `flows/` | Following execution paths and connected components. |
| `standards/` | Rules, assessments, and links back to source notes. |
| `annotations/` | Your own notes and investigation context. |

Some folders appear only after the corresponding notes are published. Put personal additions in `annotations/`. Direct edits to generated notes can stop later updates to preserve your changes. Do not edit the vault's `.system/` state manually.

Useful commands **inside Claude**:

| What you need | Example |
|---|---|
| Understand code | `/edw-doc:ask Where are inputs validated, and how are failures handled?` |
| Save an onboarding guide | `/edw-doc:onboard Explain the main execution path for a new engineer.` |
| Investigate improvement opportunities | `/edw-doc:audit Inspect the test structure and report evidence-backed findings.` |
| Refresh documentation | `/edw-doc:sync` |
| Check remaining work | `/edw-doc:status` |

`ask` reads and answers; use `onboard` when you want a saved guide. Findings are advisory and do not modify the implementation.

## 6. After code changes, a pull, or a branch switch

Run these **inside Claude**, one at a time:

```text
/edw-doc:sync
/edw-doc:status
```

Sync compares the current checkout with the stored snapshot. It detects added, changed, removed, and renamed files, refreshes static maps, and re-analyzes affected explanations and dependencies. Uncertain renames may be treated as a removal and an addition. Check its report for unresolved or incomplete work.

When standards results or reviewed notes are affected, run `/edw-doc:standards` and `/edw-doc:review` separately. Sync does not complete those separate assessments for you.

There is **one local vault per checkout**, not a saved vault for every Git branch. Switching branches does not restore an earlier branch's documentation snapshot. The next refresh reconciles the vault with the files currently checked out; older notes may become stale or be retired. Sync before relying on the documentation for your current branch.

With optional maintenance enabled, Claude session events can refresh static maps and show a reminder. They do not run an automatic AI sweep or force you to sync before continuing development. If you ignore the reminder, documentation may stay incomplete or outdated.

When Claude is closed, pulling or switching branches does not trigger this plugin: no Git hooks or always-running model worker are installed. Without a model connection, you can inspect local status from the terminal:

```sh
node "C:\tools\edw-doc-plugin\scripts\cli.mjs" status --root "C:\projects\my-project"
```

The terminal `sync` utility performs static refresh only. Use `/edw-doc:sync` in a connected Claude session for AI explanations.

## 7. Update the plugin after pulling a new release

Updating the plugin and syncing a project's documentation are separate actions. **No rebuild or reinstall of dependencies is needed.**

The regular update steps below apply once you have installed `edw-doc`. For an older `doc-vault` installation, complete the one-time rename upgrade first.

### Upgrading from Doc Vault 0.1.3 or earlier

Close the old Claude session and pull the updated plugin checkout. Replace the example paths with your existing folders. In your **terminal**:

```sh
cd "C:\tools\edw-doc-plugin"
git pull
npm run check
claude plugin disable doc-vault@doc-vault-tools --scope user
claude plugin marketplace add "C:\tools\edw-doc-plugin"
claude plugin install edw-doc@edw-doc-tools --scope user
claude plugin list
```

The catalog is now named `edw-doc-tools`. Register it explicitly: updating the old `doc-vault-tools` catalog alone does not install the renamed plugin. If Claude reports that `edw-doc-tools` is already registered, refresh it with `claude plugin marketplace update edw-doc-tools` and continue. Keep the old plugin disabled so its hooks do not run alongside the new one. If you installed in another scope, use that same scope when disabling and installing.

For each project where local integration was previously enabled, run:

```sh
node "C:\tools\edw-doc-plugin\scripts\cli.mjs" setup --root "C:\projects\my-project"
node "C:\tools\edw-doc-plugin\scripts\cli.mjs" setup-status --root "C:\projects\my-project"
```

Include the same `--vault-name` if you use a custom name. Existing owned integration files under `.claude/doc-vault/` stay in place; setup updates unchanged instructions to `/edw-doc:*` without creating a second integration. Inspect preservation warnings if you edited those instructions. Existing `edw-doc/` documentation and personal annotations remain compatible; no vault move or rebuild is required.

Start a fresh Claude session in the target project and run `/edw-doc:status`. Confirm version **0.2.0** and the intended root. The version upgrade can mark prior explanations stale and queue fresh analysis; run `/edw-doc:sync`, check coverage, and repeat standards or review when needed. Previous prose is archived and personal annotations are preserved. Old `/doc-vault:*` commands are replaced by `/edw-doc:*`.

If you only used `--plugin-dir`, skip marketplace installation and disabling: pull the checkout, repeat local setup if applicable, and restart with `--plugin-dir` pointing to that same checkout.

### Later updates to EDW Doc

Close the old Claude session. In your **terminal**:

```sh
cd "C:\tools\edw-doc-plugin"
git pull
npm run check
```

For a marketplace installation, refresh the installed plugin too:

```sh
claude plugin marketplace update edw-doc-tools
claude plugin update edw-doc@edw-doc-tools --scope user
claude plugin list
```

These examples use the user scope selected during installation. If your team installed in another scope, use that same scope when updating. If you use only `--plugin-dir`, skip these marketplace commands.

For projects where you previously enabled local setup, repeat `setup` with the same target root and vault name. This updates unchanged owned instructions and preserves user edits; inspect any reported conflicts.

Start a fresh Claude session in your target project. Run `/edw-doc:status` to verify the loaded version, then `/edw-doc:sync` to refresh the documentation. Run standards and review again when relevant. Pulling new plugin code alone does not refresh existing AI explanations.

## 8. Working across the team and different machines

The generated vault is ignored and local. A normal Git push or pull **does not share** `edw-doc/`, assessments, or personal annotations. Each teammate builds a vault on their own workstation. The optional local setup must also be performed separately for each checkout where it is wanted.

Generated files stay local, but the source evidence used for AI analysis is processed through your configured Claude model/provider. Follow the team's existing repository-access and provider rules.

## Quick troubleshooting

| Problem | What to check |
|---|---|
| `/edw-doc:*` commands are missing | Check `claude plugin list`, the enabled state, and the installation path. Restart Claude; for temporary loading, include `--plugin-dir` again. |
| An old version still appears | Refresh the marketplace and update the installed plugin, then fully restart Claude. Confirm you updated the same checkout used by the installation. |
| Approval fails or tools are unavailable | Check Node and Claude versions, plugin loading, and organization policies. Restart so both hooks and tools load. See [run approval](docs/run-approval.md). |
| Standards says the snapshot is missing or stale | Run `build` for a new vault or `sync` for an existing one, then retry standards. |
| Status is fresh but files are still unassessed | File freshness and completed AI assessment are separate. Continue the remaining standards work and recheck coverage. |
| An update reports a manually edited generated note | Preserve your text in an annotation or backup first. Review the reported conflict; do not delete state or force an overwrite. |
| Reminders do not appear | Check `setup-status`, maintenance settings, and whether a vault exists. Hooks run only at supported events while Claude is active. |

For more detail, see [installation](docs/installation.md), [vault navigation](docs/vault-layout.md), [standards](docs/standards.md), and [known limits](docs/limitations.md). Claude's official documentation covers [plugin installation and marketplaces](https://code.claude.com/docs/en/discover-plugins) and [plugin update commands](https://code.claude.com/docs/en/plugins-reference#plugin-update).
