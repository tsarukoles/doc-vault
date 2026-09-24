# Permission boundary and evidence safety

## Broker behavior

MCP calls now require a command-scoped run ID from an explicitly approved `vault_begin`. The broker checks the ID on each call and revokes it on end or lifecycle invalidation; skill `allowed-tools` grants cover only the named operations. Ephemeral lifecycle markers live in the user's temporary directory and contain no source data or authorization tokens. See [run approval](run-approval.md), including host requirements and the distinction between broker checks and host/OS isolation.

The plugin agents use a local MCP broker with named operations for inventory, approved source reads, evidence packets, managed publication, status, lint, and review records. There is no general-purpose file-write, shell, browser, Git mutation, or cloud-execution operation.

The intended write boundary is the configured vault, `edw-doc/` by default, with one explicit exception: the broker can create or append the root `.gitignore` for the exact configured vault rule and `/.claude/`. It preserves existing content and checks whether later negation prevents exclusion. A missing `.gitignore` is created. Already tracked `.claude` files are reported without changing their tracking; ignored paths already in Git remain tracked. The broker does not write `.claude` settings, install Git hooks, modify Git configuration, or patch repository source. If Git metadata exists but tracking or ignore rules cannot be inspected, generation stops.

Path validation and controlled output construction prevent ordinary traversal and arbitrary output-path requests. Source eligibility checks, bounded reads, exclusion rules, hashes, and evidence-range validation reduce accidental disclosure and stale citations. They do not prove that prose is correct or that all sensitive information was detected.

## Separate setup allowance

`setup`, `setup-status`, and `uninstall` are operator CLI commands, not MCP operations available to analysis agents. Setup requires an explicit Git repository root. Its write allowlist covers owned `.claude/edw-doc` instructions, configuration and ownership records, an owned `.claude/rules/edw-doc.md` adapter or minimal root `CLAUDE.md`, a marked import in a single supported locally ignored Claude instruction file, and the exact required `.gitignore` additions. Existing owned `.claude/doc-vault` installations and their legacy rule adapters are supported in place under the same ownership and preservation checks.

Existing tracked or unignored instruction files remain untouched. AGENTS-only or ambiguous setups use the rule adapter because host instruction loading cannot be established locally. Setup never creates `CLAUDE.local.md`, changes global instructions, edits Claude settings, installs Git hooks, or alters Git configuration. Host activation remains unverified until checked in the real host.

The installer records hashes for owned files and exact content for owned blocks. Repeated setup and uninstall preserve user edits; namespace collisions are errors rather than permission to replace existing content. Uninstall preserves the vault, ignore entries, and directories, and disables maintenance even when edited integration content remains. Ownership checks are preservation controls, not a security boundary against a hostile process that can rewrite both files and records. See [installation](installation.md) and [the business preservation rules](business-overview.md).

## Opted-in hook maintenance

Packaged hooks can statically refresh an existing owned vault only after local setup enables maintenance. Without setup, session start retains a read-only status notice. Hooks never initialize a missing vault or run repository code. Their writes use the existing broker boundary plus maintenance bookkeeping inside the vault; they do not grant setup access to the analysis agents.

Plan-mode and subagent events skip maintenance writes. `PostToolUse` skips EDW Doc broker calls and throttles repeated checks. A main-agent `Stop` event can show one nonblocking reminder per pending snapshot. It does not force a sync continuation. Failures leave work pending without indefinitely blocking normal work. Hook processes run under the host's permissions, so the checks do not replace host sandboxing. There is no permanent background AI worker, and instruction loading or a hook request does not prove completed AI analysis.

## Agent permissions are scoped

The curator receives only its named broker tools. The worker receives only read operations. The reviewer additionally receives the narrow review-record operation and cannot publish corrected notes. The standards specialist has only read operations plus rule registration and per-file assessment. It cannot scan or publish arbitrary notes. The broker derives standards output paths and links and validates source/rule revisions. These controls cannot prove that prose or a claimed repository mandate follows from evidence. The ordinary workflow works sequentially without nested subagents.

This plugin does not constrain an unrelated parent session, another plugin, or a user running separate commands. If a host grants additional tools or requires stronger filesystem isolation, use its approved native sandbox and operating-system permissions. Prompt instructions are not a substitute for that boundary. Host behavior and the installed plugin version must be verified in the intended environment.

## Repository text is untrusted input

Source comments, READMEs, filenames, workbook labels, and generated notes can contain instruction-like text. The agents treat them as evidence, not authority. A document cannot authorize tool changes, secret access, command execution, or external publication. Project guidance can be cited as a project convention without overriding these permissions.

Filtering sensitive paths and content is conservative but incomplete. Do not place secrets in the vault or publish raw records as explanations. Stop reproducing any sensitive value encountered despite filtering. Exclusions and unsupported formats must remain visible coverage gaps so privacy controls do not become false completeness claims.

## Model processing

The local runtime has no direct model-provider integration. Source content selected through the broker is available to the active host agent and therefore subject to the host's configured provider, access controls, logging, and data-handling policies. Local output storage does not mean local model inference.

The plugin does not promise zero external processing, invent a retention policy, or alter an approved Bedrock setup. Use it only with the provider and repository access approved for the environment.

## Review and concurrency

Published explanations begin as drafts. Mechanical checks validate source identity and structure; an agent reviewer checks whether passages support claims. Review requests include the exact note hash and current evidence so a verdict cannot silently attach to a replaced revision. Supported review is neither human approval nor proof of runtime correctness.

The runtime's locking and atomic updates should be exercised in the release tests. Treat filesystem races, concurrent external editors, network filesystems, and hostile local processes as reasons to use stronger host isolation; do not advertise universal tamper resistance.
