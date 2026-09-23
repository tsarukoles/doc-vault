# Validation record

This record describes development verification of version 0.1.0. It is not a production certification.

## Local verification

The automated suite passes: **45 tests, no failures or skips**. It exercises source-write boundaries, narrow ignore updates, path traversal, redirected output paths, Git worktrees, tracking checks, file maps, source fingerprints, additions/deletions/renames, dependency invalidation, evidence locators, exact-note review, publication recovery, and preservation of annotations.

It also covers CLI and MCP transport behavior, a read-only session hook, CSV and XLSX inspection limits, rejected media embeds, linked agent-note navigation, and a persistent queue for explanations requiring fresh analysis after static refresh.

Run from the plugin checkout:

```sh
npm test
npm run check
```

The package check validates bundled manifests, assets, versions, references, skill routing, and restricted agent tool lists. It checks authored package assets only, never arbitrary links in a generated target vault.

Development verification ran on Windows with Node.js 24.11.0 and Git. Node.js 20 is the declared minimum; other Node versions and operating systems have not been exercised in this development session.

## Newcomer walkthrough

A separate analysis pass used a temporary synthetic data-control repository and followed the bundled workflow: discover sources, inspect entry-point and dependency evidence, publish a bounded onboarding guide, review the exact note, find it through the analysis index, and run lint. The walkthrough completed without executing target source code. The index correctly distinguished the new guide from file notes that still had only static analysis.

This checks the workflow and runtime contract. It does not establish that an arbitrary model will fully understand every repository.

## Still to verify in the intended host

Claude Code was unavailable in the development environment. Real plugin loading, MCP registration, forked-agent tool restrictions, marketplace installation and updates, and the approved model/provider path need an integration smoke test. Bedrock requests were not made.

Use the [host pilot in the plan](plan.md) and the [installation checks](installation.md). Before public distribution, complete the [release checklist](public-release-checklist.md), including license selection.
