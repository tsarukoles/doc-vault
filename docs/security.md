# Permission boundary and evidence safety

## Broker behavior

The plugin agents use a local MCP broker with named operations for inventory, approved source reads, evidence packets, managed publication, status, lint, and review records. There is no general-purpose file-write, shell, browser, Git mutation, or cloud-execution operation.

The intended write boundary is the configured vault, `edw-doc/` by default, with one explicit exception: the broker can create or append the root `.gitignore` for the exact configured vault rule and `/.claude/`. It preserves existing content and checks whether later negation prevents exclusion. A missing `.gitignore` is created. Already tracked `.claude` files are reported without changing their tracking; ignored paths already in Git remain tracked. The broker does not write `.claude` settings, install Git hooks, modify Git configuration, or patch repository source. If Git metadata exists but tracking or ignore rules cannot be inspected, generation stops.

Path validation and controlled output construction prevent ordinary traversal and arbitrary output-path requests. Source eligibility checks, bounded reads, exclusion rules, hashes, and evidence-range validation reduce accidental disclosure and stale citations. They do not prove that prose is correct or that all sensitive information was detected.

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
