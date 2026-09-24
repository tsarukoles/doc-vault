# EDW Doc 0.2.0

Doc Vault is now **EDW Doc**. The installed plugin is `edw-doc@edw-doc-tools`, and all eight commands use `/edw-doc:*`, including `/edw-doc:build`, `/edw-doc:sync`, and `/edw-doc:standards`.

## What changes

- The plugin, agent, and broker registration names use `edw-doc`; the marketplace is `edw-doc-tools` and the runtime package is `edw-doc-plugin`.
- New environment configuration uses `EDW_DOC_ROOT` and `EDW_DOC_NAME`. Existing `DOC_VAULT_ROOT` and `DOC_VAULT_NAME` settings remain compatibility aliases.
- Fresh local integration uses `.claude/edw-doc/`. Existing owned `.claude/doc-vault/` integration stays in place; repeating setup updates unchanged instructions to the new command names without duplicating integration files.
- Team instructions and current documentation use the new name.

## Updating

Disable the old `doc-vault@doc-vault-tools` installation, register the updated checkout as the `edw-doc-tools` marketplace, and install `edw-doc@edw-doc-tools`. Restart Claude after updating. For projects with local integration, repeat setup with the same vault name and inspect preservation warnings. Follow the [team upgrade walkthrough](../GET-STARTED.md#upgrading-from-doc-vault-013-or-earlier).

Existing generated `edw-doc/` vaults and personal annotations remain compatible. This rename does not require rebuilding or moving them. Older ownership records remain supported. A legacy generated `doc-vault/` folder still uses the separate [explicit folder migration](installation.md#moving-a-010-vault).

The version upgrade can mark earlier explanations stale and queue fresh analysis. Run `/edw-doc:sync` and check coverage before relying on them; prior prose is archived and personal annotations are preserved. Run standards and review separately when needed.

The GitHub source is still `https://github.com/tsarukoles/doc-vault.git`. This release does not rename that remote, rename an existing local checkout, or move the plugin into the shared toolkit repository.

## Scope and verification

All 131 local tests passed, along with package and documentation checks. Live Claude Code installation and permission prompts remain to be verified in the target environment.

The approval contract, source-write limits, nonblocking reminders, and current analysis limitations remain in effect. This release does not add guaranteed full-sweep completion or automatically assess every standards item. Review [coverage limits](limitations.md), [the validation record](validation.md), and [the required host approval checks](run-approval.md#update-and-verify).

Earlier release notes and dated research retain historical names and command examples. Use the current team guide for new installations.
