# Validation record

This record describes development verification through version 0.2.0. It is not a production certification.

## Local verification

The 0.2.0 full-suite run passed **131 tests, no failures or skips**, and the package check passed for 59 documents, 11 JSON files, four agents, and eight skills. Added rename coverage verifies new product identity, legacy ownership and environment aliases, fixed repository binding, lifecycle revocation, replacement of old standards markers, source and annotation preservation, archived analysis after version upgrades, and safe updates/removal of legacy local integration. Existing custom vault names, edited instructions, tracked files, and duplicate integration detection are covered. The renamed plugin still needs a real Claude Code installation and approval-flow smoke test; these local checks do not validate host UI behavior.

The 0.1.3 full-suite run passed **118 tests, no failures or skips**, and the package check passed. It adds protocol and runtime checks for command-scoped approval, repeated batches, source preservation, revoked and expired grants, host-version compatibility, cancellation, compaction, and command-agent versus helper completion. The package check verifies exact skill grants and lifecycle hooks. Tests dispatch the approval tool directly; they do not verify a native permission dialog. The generic Codex skill validator could not run because PyYAML was unavailable; the repository's Claude-specific package checker validates all eight skills.

The 0.1.2 full-suite run passed **110 tests, no failures or skips**. After the final instruction-parser refinement, all **24 setup regression tests** passed, including the added unclosed-fence/comment case. These checks exercise source-write boundaries, narrow ignore updates, path traversal, redirected output paths, Git worktrees, tracking checks, file maps, source fingerprints, additions/deletions/renames, dependency invalidation, evidence locators, exact-note review, publication recovery, and preservation of annotations.

It also covers CLI and MCP transport behavior, a read-only session hook, CSV and XLSX inspection limits, rejected media embeds, linked agent-note navigation, and a persistent queue for explanations requiring fresh analysis after static refresh.

Version 0.1.1 adds missing-ignore creation, `.claude` exclusion and tracked-file diagnostics, guarded folder migration, schema-one upgrade compatibility, standards/backlinks, source and authority fingerprints, advisory-versus-declared enforcement, unknown results, dependency/relationship invalidation, and live stale counts before sync. Grader tests verify the mechanics of detecting wrong labels and invalid evidence; they do not demonstrate an agent's ability to find defects.

Version 0.1.2 adds setup/removal preservation checks, ignored versus tracked instruction handling, custom vault selection, unchanged settings and Git metadata, repeated setup, user-edited files and blocks, import chains and example imports, encoding boundaries, local namespace collisions, partial removal, and traversal/link protections. Hook tests exercise external edits and new directories, additions/deletions/renames, unchanged source bytes, one continuation per snapshot, a custom main agent, plan-mode and subagent skips, disabled maintenance, concurrent controllers, manual-note conflicts, and backlog clearing after publication. CLI and MCP tests confirm custom vault selection without adding setup tools to analysis agents.

Run from the plugin checkout:

```sh
npm test
npm run check
```

The package check validates bundled manifests, assets, versions, references, skill routing, and restricted agent tool lists. It checks authored package assets only, never arbitrary links in a generated target vault.

Development verification ran on Windows with Node.js 24.11.0 and Git. Node.js 20 is the declared minimum; other Node versions and operating systems have not been exercised in this development session.

## Source-analysis evaluation

Six fictional cases were analyzed by an agent separately from the answer key. The original run produced **5/6 deterministic classification matches and 6/6 valid evidence checks**. A separate agent found all six explanations consistent with the qualitative rubric; this is not human approval. The mismatch exposed an ambiguous `finding` field: a policy inconsistency was confused with an established implementation violation. Original predictions and the score are preserved, and future packet instructions clarify the distinction. See the [evaluation record](research/evaluation-v0.1.1.md) for artifacts and context-isolation limits.

## Earlier newcomer walkthrough

During version 0.1.0 development, a separate analysis pass used a temporary synthetic data-control repository and followed the bundled workflow: discover sources, inspect entry-point and dependency evidence, publish a bounded onboarding guide, review the exact note, find it through the analysis index, and run lint. The walkthrough completed without executing target source code. The index correctly distinguished the new guide from file notes that still had only static analysis.

This checks the workflow and runtime contract. It does not establish that an arbitrary model will fully understand every repository.

## Still to verify in the intended host

Claude Code was unavailable in the development environment. Real plugin loading, MCP registration, forked-agent tool restrictions and inherited skill grants, marketplace installation and updates, instruction activation, actual hook dispatch/Stop reminders, native permission prompt counts, and the approved model/provider path need an integration smoke test. Hook protocol tests simulate host events through the command entry points; they do not establish real host behavior. Bedrock requests were not made. Follow the [run approval checklist](run-approval.md#update-and-verify) in the target CLI.

Use the [host pilot in the plan](plan.md) and the [installation checks](installation.md). Before public distribution, complete the [release checklist](public-release-checklist.md), including license selection.
