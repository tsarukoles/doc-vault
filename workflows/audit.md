# Advisory repository audit

Clarify scope from the request and repository profile, then inspect original sources. If the index is missing, initialize through `vault_scan` only when the requested audit includes creating vault findings; otherwise report the prerequisite. If current sources differ, refresh before publishing.

Use `packs/standards.md` for assessment criteria and `templates/finding.md` for findings. Prioritize concrete consequences: unclear responsibility, contradictory rules, inconsistent failure behavior, weak traceability, and costly duplication.

Distinguish:

- **Declared requirement:** an explicit local standard, contract, or schema with a citation.
- **Observed convention:** a pattern in the inspected code, with scope and exceptions.
- **Improvement suggestion:** a reasoned proposal, with costs and uncertainty.

Search for counterexamples before claiming a repository-wide inconsistency. Similar code may serve deliberately different requirements. Missing local references cannot prove unused code when dynamic or external entry points exist. File placement needs a stated rule or observed architectural boundary, not a generic preferred folder structure.

Publish findings only when supported by current evidence. Do not pad a findings list to meet a quota. No findings in a bounded scope means no substantiated findings in that scope, not a clean bill of health. This is an engineering analysis, not a regulatory or security certification.
