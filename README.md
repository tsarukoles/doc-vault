# Doc Vault

A local repository knowledge vault for Claude Code. Doc Vault maps supported source files, helps the agent explain how components and flows work, and keeps generated documentation tied to the source that supports it.

Use it for onboarding, locating implementation details, understanding tests and data controls, and investigating source-level improvement opportunities. It works through the model and provider already approved for your Claude Code session, including a host configured for Bedrock. It does not require a separate model SDK or API key.

## What happens when you build

1. The local broker inventories the repository and creates `doc-vault/`.
2. It appends `/doc-vault/` to the root `.gitignore` if missing or followed by a rule that could re-include the vault.
3. It generates source maps, baseline file notes, and an initial onboarding guide.
4. The curator inspects source evidence, recognizes component capabilities, and enriches explanations and flows.
5. Mechanical checks report broken references and invalid evidence. A separate review command can check published claims against original source.

The source repository remains read-only apart from that controlled `.gitignore` addition. Generated content lives in the ignored vault. Read [the permission boundary](docs/security.md) for what the broker enforces and what still depends on the host.

## Quickstart

Requirements: Node.js 20 or later, Git for Git repositories, and a Claude Code installation configured for your approved model provider. The local runtime has no npm dependencies.

Keep this plugin checkout separate from the repository you want to document. From the target repository, load it for a session:

```sh
claude --plugin-dir /absolute/path/to/doc-plugin
```

Then run:

```text
/doc-vault:build
/doc-vault:status
/doc-vault:ask Where are inputs validated, and how are failures reported?
/doc-vault:onboard Explain the main execution path for a new engineer.
/doc-vault:review
```

The broker uses `DOC_VAULT_ROOT` when explicitly set; otherwise it resolves the active repository root or working directory. Verify the reported root on the first build. See [installation](docs/installation.md) for marketplace distribution and updates.

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

The main workflow runs sequentially inside a forked curator. It does not require nested subagents. A read-only worker definition is included for hosts that can dispatch bounded analysis tasks.

## Static utilities

These commands run the local broker logic without calling a model. Use absolute paths when operating from another directory:

```sh
node /absolute/path/to/doc-plugin/scripts/cli.mjs scan --root /absolute/path/to/repository
node /absolute/path/to/doc-plugin/scripts/cli.mjs sync --root /absolute/path/to/repository
node /absolute/path/to/doc-plugin/scripts/cli.mjs status --root /absolute/path/to/repository
node /absolute/path/to/doc-plugin/scripts/cli.mjs lint --root /absolute/path/to/repository
node /absolute/path/to/doc-plugin/scripts/cli.mjs watch --root /absolute/path/to/repository
```

`watch` is optional. It refreshes static maps and invalidation state while running; it does not start a model or rewrite semantic explanations. Run `/doc-vault:sync` to update those explanations. A read-only plugin `SessionStart` hook reports freshness when a vault already exists; it does not create or update one. No Git hooks or Git configuration are installed.

## How analysis adapts

Doc Vault distinguishes repository purpose, component capabilities, and implementation technologies. One repository can use several analysis lenses:

- **E2E automation:** runner → fixtures → test → application boundary → assertion → reporting.
- **Data controls:** metadata → loader → rule dispatch → dataset selection → check → result handling.
- **General code and configuration:** entry points, responsibilities, declared dependencies, decisions, and external boundaries.
- **Practices:** supplied standards, observed conventions, and carefully qualified improvement suggestions.

Static relationships are candidates for model inspection. A filename or import does not establish an entire business process. See [analysis and support limits](docs/analysis.md).

## Notes and navigation

Meaningful supported non-Markdown sources receive managed file notes. Markdown is supporting reference material, without a duplicate file note. Coverage reports identify excluded and unsupported sources.

Notes use Markdown and vault-local wiki links for navigation in Obsidian or another compatible viewer. Open `doc-vault/` as the vault. The broker owns note identifiers, timestamps, source hashes, generated links, and review records. Keep personal notes in `doc-vault/annotations/`; the publisher stops when it detects edits to a managed note so you can preserve those edits separately. See [the vault layout](docs/vault-layout.md).

The ignored vault is local. Pulling or pushing source does not share its contents. Rebuild it on each workstation or define a separate approved sharing process. Cross-repository and remote references remain unresolved boundaries in this version.

## What this version does not prove

An inventory is not exhaustive semantic analysis. A citation validates a source location, not the truth of every sentence. Agent review is not human approval. Static analysis does not execute tests, inspect deployed cloud resources, validate production data, or certify compliance.

Excel support is structural: available sheet names, cell addresses/types, and counts. Cell values and formula expressions are omitted; formulas and macros are never executed. Rule semantics require other available source evidence. See [known limits](docs/limitations.md).

## Package layout

```text
.claude-plugin/      Plugin and marketplace manifests
.mcp.json            Local broker registration
hooks/               Read-only session-start freshness notice
agents/              Curator, read-only worker, separate reviewer
skills/              User-facing build/sync/audit/onboard/ask/status/review
policies/            Authority, evidence, and output rules
workflows/           Progressive analysis and maintenance instructions
packs/               E2E, data-control, generic, and standards lenses
templates/           File, component, flow, profile, finding, and guide shapes
schemas/             Publication and review contract references
scripts/             Local CLI and MCP entry points
src/                 Filesystem boundary, inventory, readers, and engine
tests/               Synthetic behavior and boundary checks
fixtures/            Synthetic repositories for verification
docs/                Architecture, operations, and release guidance
```

For implementation decisions and acceptance criteria, see [the plan](docs/plan.md). From this checkout, run `node --test` for runtime checks and `npm run check` for package manifests, restricted agent tools, bundled guidance, and documentation links. See [what was verified](docs/validation.md) for the scope and remaining host checks. Before sharing or publishing a distribution, use [the release checklist](docs/public-release-checklist.md).
