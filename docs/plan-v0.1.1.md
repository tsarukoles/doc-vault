# Version 0.1.1 implementation plan

The release improves explanations and makes standards review inspectable without granting the model source-editing or execution privileges.

1. Research comparable documentation and review systems from primary sources. Adopt bounded evidence packets, relationship-aware refresh, explicit coverage, versioned rules, and positive/negative evaluation cases. Keep references and tradeoffs in `docs/research/`.
2. Rename the default output directory to `edw-doc/`. Keep the plugin name and `/doc-vault:*` commands. Append `/edw-doc/` and `/.claude/` to the target's root `.gitignore`, creating it when absent. Keep existing content. Report tracked session files without untracking them. Offer explicit, guarded migration for an existing `doc-vault/`.
3. Require plain-language explanations of behavior, branches, inputs/outputs, tests, checks, failure paths, relationships, evidence gaps, and improvement candidates. Scope depth to the file's actual responsibilities. Do not equate long text with useful analysis.
4. Add a standards specialist and separate workflow. Ship a small offline advisory catalog. Register repository requirements and observed conventions with source evidence. Never promote a recommendation to a project requirement.
5. Store assessments with source hashes, rule fingerprints, authority evidence, timestamps, rationale, and qualified outcomes. Derive file-to-rule and rule-to-file wiki links in the broker. Unknown and not-assessed remain visible. Source or policy changes invalidate affected results and reviews.
6. Test boundaries, migration, ignore handling, evidence freshness, result semantics, recovery, and links. Separately evaluate an independent agent on synthetic examples with known expected answers. Mechanical tests cannot demonstrate semantic defect detection.
7. Review the public package, update the human/AI guides, and publish version 0.1.1 after checks pass. Record host-specific validation still needed in Claude Code.

## Permission boundary

The model's runtime tools read inspected repository sources and write only the owned vault. Initialization may append the two authorized ignore rules. Explicit folder migration is an operator command, not a model tool. It may rename an owned root-level vault after validation. No target code execution, cloud inspection, source modification, Git configuration change, untracking, or new network capability is added.

## Success criteria

- A new user can locate a file, understand its behavior and checks, follow an evidence-backed flow, and find the applicable standard and its assessment.
- Every included file is accounted for even when semantic analysis has not happened.
- Changed sources and changed rules cannot silently retain current assessments.
- Source and manually edited notes remain protected; static coverage and semantic review are reported separately.
- Existing vaults have an explicit migration path without automatic deletion or merging.
