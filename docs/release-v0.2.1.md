# EDW Doc 0.2.1

Approved `/edw-doc:build` and `/edw-doc:sync` scans now set up project integration as part of the same command approval. Earlier builds could produce a vault without creating `.claude` or connecting Claude instructions because those steps required separate setup.

## What changes

- In a Git project, the broker creates missing owned integration under `.claude/edw-doc/` and adds a supported instruction reference. If neither root `CLAUDE.md` nor `.claude/CLAUDE.md` exists, it creates a minimal ignored root `CLAUDE.md`, preserving other instruction files.
- Existing instructions, settings, rules, scripts, hooks, user edits, and disabled-maintenance preferences remain intact. Existing owned `.claude/doc-vault/` integration is reused in place.
- Build/sync return integration status, changes, repairs, and warnings alongside analysis results. Non-Git directories can still receive a vault; integration is skipped with a reported reason because setup requires inspectable Git state.
- Explicit CLI setup can repair missing owned files safely. A missing configuration file is restored with maintenance disabled rather than guessing the user's previous preference.
- The team guide covers installation from `edw-ai-toolkit/plugins/edw-doc`, using the toolkit-root marketplace catalog named `edw-doc-tools`.
- Package validation accepts the toolkit-root catalog, with or without a plugin-local standalone catalog, and verifies that its EDW Doc entry points to the actual plugin folder.
- Ignore diagnostics check Git's effective rules and show the project root, Git root, protected paths, and any already tracked vault files. A matching line of text alone no longer counts as verified protection.

Runtime scripts and hook logic remain packaged with the plugin. No scripts are copied into the target project. Other analysis commands, plain static CLI scans, and hooks do not install integration.

## Updating

Pull the updated toolkit checkout, refresh the `edw-doc-tools` marketplace, update `edw-doc@edw-doc-tools`, and restart Claude. Verify version 0.2.1 with `/edw-doc:status`, then run `/edw-doc:sync`. Inspect its integration result and preservation warnings. See [the team guide](../GET-STARTED.md#7-update-the-installed-plugin).

Existing vaults and annotations need no move. As with other version changes, earlier explanations can become stale and require fresh analysis; previous prose is archived and personal annotations are preserved. Explicit `setup` remains available for integration inspection and repair without AI analysis.

## Scope and verification

This release changes first-use integration and installation guidance. It does not add guaranteed full-sweep completion, automatic AI synchronization from hooks, or automatic standards assessment. Existing [coverage limits](limitations.md) remain in effect.

Local automated checks exercise setup, preservation, command scope, and package structure. They do not establish live Claude instruction activation or the actual permission prompt count. The intended Claude CLI/provider environment still needs the [host verification checklist](run-approval.md#update-and-verify).
