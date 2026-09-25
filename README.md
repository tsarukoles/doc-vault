# EDW Doc

A local repository knowledge vault for Claude Code. EDW Doc maps supported source files, helps the agent explain how components and flows work, and keeps generated documentation tied to the source that supports it.

Use it for onboarding, locating implementation details, understanding tests and data controls, and investigating source-level improvement opportunities. It works through the model and provider already approved for your Claude Code session, including a host configured for Bedrock. It does not require a separate model SDK or API key.

For a nontechnical explanation of capabilities, preservation rules, and scope, start with [the business overview](docs/business-overview.md).

For team installation, first use, everyday commands, and updates, follow [GET-STARTED.md](GET-STARTED.md).

For the business goals, target requirements, and acceptance criteria, see [BUSINESS-REQUIREMENTS.md](BUSINESS-REQUIREMENTS.md). This is a requirements brief, not a statement that every capability has shipped.

## What happens when you build

1. The local broker inventories the repository and creates `edw-doc/` by default.
2. Under the same command approval, it sets up owned project instructions in `.claude/edw-doc/` and connects them to Claude. If neither root `CLAUDE.md` nor `.claude/CLAUDE.md` exists, it creates an ignored root `CLAUDE.md`; otherwise, it preserves the existing instructions and adds a safe reference or rule adapter. It creates or appends the root `.gitignore` for these local outputs and verifies the ignore rules. Already tracked files are reported; their tracking is unchanged.
3. It generates source maps, baseline file notes, and an initial onboarding guide.
4. The curator inspects source evidence and explains meaningful files, folders, tests, and flows in plain language: steps, decisions, helpers, inputs, outputs, checks, failures, and supported improvement opportunities.
5. Mechanical checks report broken references and invalid evidence. A separate review command can check published claims against original source.
6. The dedicated standards skill catalogs evidenced requirements and conventions, assesses applicable files, and connects file notes to standards pages in both directions. Initial rules start as unassessed candidates.

Project source remains read-only. Approved build and sync commands also have a narrow broker-controlled allowance for owned local integration files, instruction references, and ignore rules. Other analysis commands and static CLI scans do not install integration. The agents never receive arbitrary filesystem or shell access. Read [the permission boundary](docs/security.md).

## Quickstart

Version 0.2.1 adds automatic project integration to approved build and sync commands. The plugin is installed as `edw-doc@edw-doc-tools` and invoked with `/edw-doc:*`, as introduced in 0.2.0. It retains one native approval per command and exact tool grants for the rest of that invocation, introduced in 0.1.3. It requires Claude Code CLI 2.1.199 or later. Existing users should follow the [rename upgrade steps](GET-STARTED.md#upgrading-from-doc-vault-013-or-earlier). See [run approval and the host verification checklist](docs/run-approval.md). No global permission bypass or settings changes are needed. The real CLI prompt flow still needs verification in the target environment.

Requirements: Node.js 20 or later, Git for Git repositories, and a Claude Code installation configured for your approved model provider. The local runtime has no npm dependencies.

For the shared toolkit, keep the complete package in `edw-ai-toolkit/plugins/edw-doc` and register the toolkit-root `.claude-plugin/marketplace.json`, whose catalog name is `edw-doc-tools` and plugin source is `./plugins/edw-doc`. From the toolkit root:

```sh
claude plugin marketplace add ./
claude plugin install edw-doc@edw-doc-tools --scope user
```

See [the team guide](GET-STARTED.md#2-prepare-the-toolkit-catalog) for the complete layout and catalog. Keep the toolkit separate from the target project. Alternatively, from the target repository, load the plugin for one session:

```sh
claude --plugin-dir /absolute/path/to/edw-ai-toolkit/plugins/edw-doc
```

Then run:

```text
/edw-doc:build
/edw-doc:standards
/edw-doc:status
/edw-doc:ask Where are inputs validated, and how are failures reported?
/edw-doc:onboard Explain the main execution path for a new engineer.
/edw-doc:review
```

The broker uses `EDW_DOC_ROOT` when explicitly set; otherwise it resolves the active repository root or working directory. The old `DOC_VAULT_ROOT` and `DOC_VAULT_NAME` settings remain compatibility aliases. Verify the reported root on the first build. See [installation](docs/installation.md) for marketplace distribution and updates.

## Project integration

Approved `/edw-doc:build` and `/edw-doc:sync` scans set up local instructions and maintenance at supported Claude Code events. No separate setup step is required for first use in an inspectable Git repository root. Non-Git folders can still receive a vault, but integration is skipped with a reported reason. To inspect integration, or explicitly set it up or repair missing owned files without building documentation, use:

```sh
node /absolute/path/to/edw-ai-toolkit/plugins/edw-doc/scripts/cli.mjs setup --root /absolute/path/to/repository
node /absolute/path/to/edw-ai-toolkit/plugins/edw-doc/scripts/cli.mjs setup-status --root /absolute/path/to/repository
```

Fresh setup adds owned files under `.claude/edw-doc/`. Existing owned `.claude/doc-vault/` installations stay in place. Setup reuses a single existing, locally ignored `CLAUDE.md` or `.claude/CLAUDE.md` with a marked import. Tracked, unignored, or ambiguous Claude instructions stay untouched and use an ignored rule adapter. If neither Claude entry point exists, setup creates an ignored root `CLAUDE.md`, even when `AGENTS.md` or `CLAUDE.local.md` already exists. Existing instructions, settings, scripts, hooks, and disabled-maintenance preferences are preserved. Runtime scripts remain in the plugin; they are not copied into the project. Namespace collisions are reported without overwriting user content.

The standalone setup command does not build a vault. Hooks maintain only an existing owned vault and never install integration. Build and sync report integration status and warnings alongside their analysis results. Instruction activation remains unverified because host settings and version can affect loading. See [setup and preservation details](docs/installation.md#project-integration).

## Commands

| Skill | Result |
|---|---|
| `/edw-doc:build` | Set up project integration, initialize static maps, and enrich file, component, flow, and profile notes. |
| `/edw-doc:sync` | Ensure project integration, re-index changes, and re-analyze affected explanations. |
| `/edw-doc:audit` | Publish evidence-backed advisory findings about structure and practices. |
| `/edw-doc:onboard` | Create an onboarding guide for the requested role or question. |
| `/edw-doc:ask` | Answer a repository question from current evidence; no writes by default. |
| `/edw-doc:status` | Report freshness and coverage without changing files. |
| `/edw-doc:review` | Check published claims in a separate agent context and record qualified verdicts. |
| `/edw-doc:standards` | Discover standards and record evidence-backed per-file assessments with wiki links and coverage. |

The main workflow runs sequentially inside a forked curator. It does not require nested subagents. The standards specialist and reviewer run in separate skill contexts, with narrowly scoped write operations. A read-only worker definition is included for hosts that can dispatch bounded analysis tasks.

## Static utilities

These commands run the local broker logic without calling a model. The example `/absolute/path/to/edw-doc-plugin` means the plugin directory itself, such as `/absolute/path/to/edw-ai-toolkit/plugins/edw-doc` in the toolkit. Use absolute paths when operating from another directory:

```sh
node /absolute/path/to/edw-doc-plugin/scripts/cli.mjs scan --root /absolute/path/to/repository
node /absolute/path/to/edw-doc-plugin/scripts/cli.mjs sync --root /absolute/path/to/repository
node /absolute/path/to/edw-doc-plugin/scripts/cli.mjs status --root /absolute/path/to/repository
node /absolute/path/to/edw-doc-plugin/scripts/cli.mjs lint --root /absolute/path/to/repository
node /absolute/path/to/edw-doc-plugin/scripts/cli.mjs watch --root /absolute/path/to/repository
```

These static utilities do not install project integration. `watch` is optional. It refreshes static maps and invalidation state while running; it does not start a model or rewrite semantic explanations. Run `/edw-doc:sync` to update those explanations and ensure integration.

Without local setup, the plugin's session-start hook remains a read-only freshness notice. With maintenance enabled by setup, session start, new prompts, tool activity, and agent completion can refresh static state. Plan-mode and subagent events are skipped, and repeated tool events are throttled. External edits, pulls, and branch changes are discovered at the next reconciliation event. No Git hooks, Git configuration, or permanent background process are installed.

The finish hook shows one nonblocking sync reminder per pending snapshot. It never forces the coding session to continue or starts a model sweep. Standards assessments and independent review remain separate commands. When Claude Code is closed, session hooks do not run. See [maintenance boundaries](docs/architecture.md#maintenance).

## How analysis adapts

EDW Doc distinguishes repository purpose, component capabilities, and implementation technologies. One repository can use several analysis lenses:

- **E2E automation:** runner → fixtures → test → application boundary → assertion → reporting.
- **Data controls:** metadata → loader → rule dispatch → dataset selection → check → result handling.
- **General code and configuration:** entry points, responsibilities, declared dependencies, decisions, and external boundaries.
- **Practices:** declared repository standards, observed conventions, maintained advisory guidance, and carefully qualified improvement suggestions.

Static relationships are candidates for model inspection. A filename or import does not establish an entire business process. See [analysis and support limits](docs/analysis.md).

## Notes and navigation

Meaningful supported non-Markdown sources receive managed file notes. Markdown is supporting reference material, without a duplicate file note. Coverage reports identify excluded and unsupported sources.

Notes use Markdown and vault-local wiki links for navigation in Obsidian or another compatible viewer. Open `edw-doc/` as the vault. The broker owns note identifiers, timestamps, source hashes, generated links, and review records. Keep personal notes in `edw-doc/annotations/`; the publisher stops when it detects edits to a managed note so you can preserve those edits separately. See [the vault layout](docs/vault-layout.md).

The shared [documentation style](policies/documentation-style.md) calls for simple explanations, numbered procedures and reading paths when order matters, and source-backed diagrams when useful. Ordinary wiki links form Obsidian graph connections; Mermaid diagrams explain processes within notes. A diagram must not invent missing logic or deployed connections.

File notes include a standards section. Results distinguish complies, diverges, noncompliant, unknown, not applicable, not assessed, and stale. Only a demonstrated violation of a declared requirement can be noncompliant; bundled recommendations remain advisory. These are static source assessments, not executed checks or certification. See [standards and assessment](docs/standards.md).

The ignored vault is local. Pulling or pushing source does not share its contents. Rebuild it on each workstation or define a separate approved sharing process. Cross-repository and remote references remain unresolved boundaries in this version.

## Updating

Version 0.2.1 adds project integration during approved build and sync scans. Update the installed plugin, restart Claude, and run `/edw-doc:sync`; inspect its integration result and preservation warnings. Existing configuration and user edits remain intact. Explicit `setup` is also available for repair without analysis. See [the 0.2.1 release notes](docs/release-v0.2.1.md).

If upgrading from the old `doc-vault` name, follow the [rename upgrade steps](GET-STARTED.md#upgrading-from-doc-vault-013-or-earlier). The existing generated `edw-doc/` vault remains compatible and needs no move or rebuild. Plugin distribution updates do not by themselves complete fresh AI analysis. The [0.2.0 release notes](docs/release-v0.2.0.md) describe the rename.

The original standalone GitHub source is still `https://github.com/tsarukoles/doc-vault.git`. It is not the team's toolkit URL. The installation guide supports the toolkit layout; copying and publishing this package into that repository is a separate maintainer action.

The version change can mark previous explanations stale and queue them for re-analysis. Run `/edw-doc:sync` and check coverage before relying on them; previous prose is archived and personal annotations are preserved.

### Moving a 0.1.0 vault

Version 0.1.1 changed the default generated folder from `doc-vault/` to `edw-doc/`. Version 0.2.0 also renames the plugin and commands. Existing vaults are not silently moved. To migrate a previous default vault, run this from the plugin checkout:

```sh
node scripts/cli.mjs migrate --root /absolute/path/to/repository --from doc-vault --to edw-doc
```

Then start a new plugin session in the target repository and run `/edw-doc:sync`, `/edw-doc:standards`, and `/edw-doc:review` as needed. Migration preserves personal annotations; revised guidance still needs fresh agent analysis. A custom configured vault name remains supported. See [updates and migration](docs/installation.md).

## What this version does not prove

An inventory is not exhaustive semantic analysis. A citation validates a source location, not the truth of every sentence. Agent review is not human approval. Static analysis does not execute tests, inspect deployed cloud resources, validate production data, or certify compliance.

Excel support is structural: available sheet names, cell addresses/types, and counts. Cell values and formula expressions are omitted; formulas and macros are never executed. Rule semantics require other available source evidence. See [known limits](docs/limitations.md).

## Package layout

```text
.claude-plugin/      Plugin and marketplace manifests
.mcp.json            Local broker registration
hooks/               Session notice and opted-in maintenance events
agents/              Curator, read-only worker, reviewer, standards specialist
skills/              Build/sync/audit/onboard/ask/status/review/standards
policies/            Authority, evidence, and output rules
workflows/           Progressive analysis and maintenance instructions
packs/               Domain lenses and versioned offline standards guidance
templates/           File, component, flow, profile, finding, and guide shapes
schemas/             Note, review, rule, and assessment contracts
scripts/             Local CLI and MCP entry points
src/                 Filesystem boundary, inventory, readers, and engine
tests/               Synthetic behavior and boundary checks
fixtures/            Synthetic repositories for verification
docs/                Architecture, operations, and release guidance
```

For implementation decisions and acceptance criteria, see [architecture](docs/architecture.md), [the 0.1.2 release notes](docs/release-v0.1.2.md), [the original plan](docs/plan.md), and [the 0.1.1 plan](docs/plan-v0.1.1.md). Research covers [repository wiki systems](docs/research/wiki-systems.md) and [standards/review systems](docs/research/standards-systems.md); the [source-analysis exercise](docs/research/evaluation-v0.1.1.md) records results and limits. From this checkout, run `node --test` for runtime checks and `npm run check` for package manifests, restricted agent tools, bundled guidance, and documentation links. See [what was verified](docs/validation.md) for the scope and remaining host checks. Before sharing or publishing a distribution, use [the release checklist](docs/public-release-checklist.md).
