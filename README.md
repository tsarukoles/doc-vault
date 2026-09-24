# Doc Vault

A local repository knowledge vault for Claude Code. Doc Vault maps supported source files, helps the agent explain how components and flows work, and keeps generated documentation tied to the source that supports it.

Use it for onboarding, locating implementation details, understanding tests and data controls, and investigating source-level improvement opportunities. It works through the model and provider already approved for your Claude Code session, including a host configured for Bedrock. It does not require a separate model SDK or API key.

For a nontechnical explanation of capabilities, preservation rules, and scope, start with [the business overview](docs/business-overview.md).

## What happens when you build

1. The local broker inventories the repository and creates `edw-doc/` by default.
2. It creates or appends the root `.gitignore` to ensure `/edw-doc/` and `/.claude/` are ignored, preserving existing content. Already tracked `.claude` files are reported; their tracking is unchanged.
3. It generates source maps, baseline file notes, and an initial onboarding guide.
4. The curator inspects source evidence and explains meaningful files, folders, tests, and flows in plain language: steps, decisions, helpers, inputs, outputs, checks, failures, and supported improvement opportunities.
5. Mechanical checks report broken references and invalid evidence. A separate review command can check published claims against original source.
6. The dedicated standards skill catalogs evidenced requirements and conventions, assesses applicable files, and connects file notes to standards pages in both directions. Initial rules start as unassessed candidates.

During ordinary analysis, the source repository remains read-only apart from that controlled `.gitignore` addition. Optional local setup has a separate, narrow allowance for owned integration files and references; it does not expand the analysis agents' tools. Read [the permission boundary](docs/security.md).

## Quickstart

Version 0.1.3 adds one native approval per Doc Vault command and exact tool grants for the rest of that invocation. It requires Claude Code CLI 2.1.199 or later. Reload/update the plugin before using the new broker tools; see [run approval and the host verification checklist](docs/run-approval.md). No global permission bypass or settings changes are needed. The real CLI prompt flow still needs verification in the target environment.

Requirements: Node.js 20 or later, Git for Git repositories, and a Claude Code installation configured for your approved model provider. The local runtime has no npm dependencies.

Keep this plugin checkout separate from the repository you want to document. From the target repository, load it for a session:

```sh
claude --plugin-dir /absolute/path/to/doc-plugin
```

Then run:

```text
/doc-vault:build
/doc-vault:standards
/doc-vault:status
/doc-vault:ask Where are inputs validated, and how are failures reported?
/doc-vault:onboard Explain the main execution path for a new engineer.
/doc-vault:review
```

The broker uses `DOC_VAULT_ROOT` when explicitly set; otherwise it resolves the active repository root or working directory. Verify the reported root on the first build. See [installation](docs/installation.md) for marketplace distribution and updates.

## Optional local integration

To add local instructions and enable maintenance at supported Claude Code events, run this separate setup command against the target Git repository root:

```sh
node /absolute/path/to/doc-plugin/scripts/cli.mjs setup --root /absolute/path/to/repository
node /absolute/path/to/doc-plugin/scripts/cli.mjs setup-status --root /absolute/path/to/repository
```

Setup adds owned files under `.claude/doc-vault/`. It reuses a single existing, locally ignored `CLAUDE.md` or `.claude/CLAUDE.md` with a marked import. Tracked, unignored, ambiguous, or AGENTS-only instruction setups stay untouched and use an ignored rule adapter. With no detected instruction entry point, setup creates an ignored root `CLAUDE.md`. It never creates `CLAUDE.local.md`, changes global instructions, or edits Claude settings. Namespace collisions are reported; user content is preserved.

Setup does not build a vault. Run `/doc-vault:build` after loading the plugin; hooks maintain only an existing owned vault. The installer reports instruction activation as unverified because host settings and version can affect loading. See [setup and preservation details](docs/installation.md#optional-local-integration).

## Commands

| Skill | Result |
|---|---|
| `/doc-vault:build` | Initialize static maps and enrich file, component, flow, and profile notes. |
| `/doc-vault:sync` | Re-index changes and re-analyze affected explanations. |
| `/doc-vault:audit` | Publish evidence-backed advisory findings about structure and practices. |
| `/doc-vault:onboard` | Create an onboarding guide for the requested role or question. |
| `/doc-vault:ask` | Answer a repository question from current evidence; no writes by default. |
| `/doc-vault:status` | Report freshness and coverage without changing files. |
| `/doc-vault:review` | Check published claims in a separate agent context and record qualified verdicts. |
| `/doc-vault:standards` | Discover standards and record evidence-backed per-file assessments with wiki links and coverage. |

The main workflow runs sequentially inside a forked curator. It does not require nested subagents. The standards specialist and reviewer run in separate skill contexts, with narrowly scoped write operations. A read-only worker definition is included for hosts that can dispatch bounded analysis tasks.

## Static utilities

These commands run the local broker logic without calling a model. Use absolute paths when operating from another directory:

```sh
node /absolute/path/to/doc-plugin/scripts/cli.mjs scan --root /absolute/path/to/repository
node /absolute/path/to/doc-plugin/scripts/cli.mjs sync --root /absolute/path/to/repository
node /absolute/path/to/doc-plugin/scripts/cli.mjs status --root /absolute/path/to/repository
node /absolute/path/to/doc-plugin/scripts/cli.mjs lint --root /absolute/path/to/repository
node /absolute/path/to/doc-plugin/scripts/cli.mjs watch --root /absolute/path/to/repository
```

`watch` is optional. It refreshes static maps and invalidation state while running; it does not start a model or rewrite semantic explanations. Run `/doc-vault:sync` to update those explanations.

Without local setup, the plugin's session-start hook remains a read-only freshness notice. With maintenance enabled by setup, session start, new prompts, tool activity, and agent completion can refresh static state. Plan-mode and subagent events are skipped, and repeated tool events are throttled. External edits, pulls, and branch changes are discovered at the next reconciliation event. No Git hooks, Git configuration, or permanent background process are installed.

The finish hook shows one nonblocking sync reminder per pending snapshot. It never forces the coding session to continue or starts a model sweep. Standards assessments and independent review remain separate commands. When Claude Code is closed, session hooks do not run. See [maintenance boundaries](docs/architecture.md#maintenance).

## How analysis adapts

Doc Vault distinguishes repository purpose, component capabilities, and implementation technologies. One repository can use several analysis lenses:

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

Version 0.1.3 adds scoped run approval and exact per-command tool grants; it retains the optional local setup, static maintenance, and shared writing guidance from 0.1.2. After updating, restart the plugin session and run sync to apply revised analysis guidance. Run `setup` again only for repositories where you want the local integration; it preserves configuration and user edits. Plugin distribution updates do not by themselves complete fresh AI analysis. See [the 0.1.2 release notes](docs/release-v0.1.2.md).

### Moving a 0.1.0 vault

Version 0.1.1 changes the default generated folder from `doc-vault/` to `edw-doc/`; the plugin name and `/doc-vault:*` commands stay the same. Existing vaults are not silently moved. To migrate a previous default vault, run this from the plugin checkout:

```sh
node scripts/cli.mjs migrate --root /absolute/path/to/repository --from doc-vault --to edw-doc
```

Then start a new plugin session in the target repository and run `/doc-vault:sync`, `/doc-vault:standards`, and `/doc-vault:review` as needed. Migration preserves personal annotations; revised guidance still needs fresh agent analysis. A custom configured vault name remains supported. See [updates and migration](docs/installation.md).

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
