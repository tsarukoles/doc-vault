# Doc Vault 0.1.1

> Historical record: names and examples below describe earlier Doc Vault releases. Since 0.2.0, use EDW Doc and the current [team guide](../GET-STARTED.md).

This release deepens source explanations, adds a dedicated standards workflow, and changes the default output directory to **`edw-doc/`**. The plugin name and `/doc-vault:*` commands remain unchanged.

## Changes

- Build/sync ensures both the configured vault folder and `/.claude/` are ignored. A missing root `.gitignore` is created; existing content is preserved. Already tracked session files are reported without changing Git tracking. Session metadata is excluded from source analysis.
- File, folder, test, flow, and onboarding instructions require concrete behavior: inputs, steps, decisions, helpers, outputs, assertions, failure paths, evidence gaps, and supported improvements. The writer must examine source and relevant dependencies before describing behavior.
- `/doc-vault:standards` uses a separate specialist with narrowly scoped tools. Twelve original offline advisory rules cover languages, testing, CI/CD, databases, and data transformations. Project requirements and observed conventions are registered separately with evidence and scope.
- File notes link to rule pages; rule pages link back to their candidate files. Tables show complies, diverges, noncompliant, unknown, not-applicable, or not-assessed. Only declared requirements can produce noncompliant. No source execution or certification is implied.
- Source, dependency, relationship, policy, and catalog changes invalidate relevant assessments. Live status reports staleness before sync. Rule edits also queue existing explanations for fresh analysis and invalidate exact-note reviews.
- Research-driven evaluation includes known defects, correct behavior, a permitted exception, missing evidence, and conflicting requirements. The first exercise and its one grading ambiguity are preserved in the [evaluation record](research/evaluation-v0.1.1.md).

## Upgrade

Update the plugin checkout or installed marketplace distribution using the host's supported update flow. A running session may still have the old broker or skills loaded; start a fresh session after updating. Automatic distribution updates depend on the host settings and do not regenerate local vaults by themselves.

If the target already has a `doc-vault/` generated folder, run this from the plugin checkout:

```sh
node scripts/cli.mjs migrate --root /absolute/path/to/target --from doc-vault --to edw-doc
```

The move is explicit. It preserves all vault bytes, including annotations, and refuses existing destinations, unrecognized ownership, tracked output, links, active or stale writer locks, and unfinished publication journals. Resolve/recover a prior writer using the existing vault before moving it. The default build detects an owned legacy folder and asks for migration instead of silently creating a second vault. External shortcuts to the old folder must be updated separately.

Then load the updated plugin from the target repository and run:

```text
/doc-vault:sync
/doc-vault:standards
/doc-vault:review
/doc-vault:status
```

For a new repository, begin with `/doc-vault:build`. To retain a previous custom folder, consistently configure `DOC_VAULT_NAME` for the host and `--vault-name` for CLI calls.

## Validation and limits

See [the validation record](validation.md) for automated tests and remaining host checks. Runtime verification is separate from the small semantic exercise. The broker has no new cloud/network capability, and source code remains read-only apart from the authorized ignore additions. Explicit migration is an operator CLI action, not a model tool. Rule/finding quality still depends on source completeness and the host model.

The runtime still uses bounded lexical relationships, not a complete multi-language call graph. Workbook inspection remains structural. Standards applicability begins with language/kind/path candidates and requires source inspection. Human resolution of policy conflicts and real-host testing remain necessary.
