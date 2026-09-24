# Research: standards, review systems, and semantic evaluations

Research date: **2026-09-23**. These are original design recommendations based on primary documentation and public project material. No external implementation or rule collection was copied. Product capabilities and licenses can change; the references record what was inspected on this date. These systems were researched, not installed or benchmarked.

## What is useful for Doc Vault

The most useful pattern is a small rule record with explicit applicability, source authority, evidence, and a separately recorded assessment. A large prompt demanding improvements is not a reliable substitute. File freshness, coverage, finding correctness, and human approval are separate facts.

| System and primary reference | Relevant mechanism | Adaptation for Doc Vault | Exclude or defer |
| --- | --- | --- | --- |
| [PR-Agent repository](https://github.com/The-PR-Agent/pr-agent) and [self-reflection workflow](https://docs.pr-agent.ai/core-abilities/self_reflection/) | A follow-up pass challenges and ranks initial suggestions; compact summaries expand into details. | Require a finding to survive a counterexample check. Present a short consequence first, followed by evidence and limits. | Numerical model confidence is not proof. Do not add automatic source fixes or PR approval. |
| [CodeRabbit path instructions](https://docs.coderabbit.ai/configuration/path-instructions) | File selection and focused instructions are different controls; repository guidelines can supply context. | Apply language, file-kind, and path-scoped standards. Distinguish excluded files from reviewed files with no finding. | Do not copy its hosted service, repository-writing features, or automatically treat arbitrary repository text as trusted instructions. |
| [Semgrep rule schema](https://docs.semgrep.dev/writing-rules/rule-syntax) | Identified rules have language scope, a message, matching logic, optional paths, metadata, and version conditions. | Keep stable rule IDs, explicit scope, references, and catalog version. Store the reviewed source hash and rule fingerprint with each result. | An AI assessment is not a Semgrep scan. Do not claim AST/data-flow guarantees or import a third-party rule corpus without a separate license review. |
| [Semgrep rule tests](https://docs.semgrep.dev/writing-rules/testing-rules) | Fixtures identify expected detections and expected non-detections, including known future work. | Test both missed defects and false alarms. Include deliberate exceptions and insufficient-evidence cases. | Snapshot agreement alone cannot establish semantic accuracy. |
| [SonarQube issue decisions](https://docs.sonarsource.com/sonarqube-server/user-guide/issues/managing) | Accepting a known issue differs from deciding the analysis is mistaken; decisions can be reopened. | Keep human decisions and their reasons separate from the agent's observation. Reconsider results when relevant source or rule changes. | Do not silently relabel an accepted divergence as compliance, or give the model authority to approve itself. Durable human adjudication can be a later feature. |
| [Promptfoo assertions and metrics](https://www.promptfoo.dev/docs/configuration/expected-outputs/) | Deterministic output checks coexist with model-assisted rubric grading. | Validate evidence IDs and statuses mechanically; use a human-written rubric for explanation quality and finding correctness. Record the model and prompt version used. | No new evaluation service dependency is necessary. A second model's pass must not be reported as a factual ground truth. |

The historical `qodo-ai/pr-agent` URL redirected to `The-PR-Agent/pr-agent` during research. The repository distinguishes the community PR-Agent project from Qodo's current product. This report attributes PR-Agent mechanisms to that project rather than assuming product parity.

## Standards authority and applicability

Use this reasoning order:

1. Find an explicit project requirement and establish its scope, effective version, and exceptions.
2. Inspect configured checks. A linter option proves configuration, not a successful run.
3. Consult an applicable curated external reference. Unless the project adopted it, it remains advice.
4. Record recurring local patterns as observations with sample scope and counterexamples.
5. Keep an agent's proposed improvement separate from all of the above.

This hierarchy is a Doc Vault design choice, informed by the scoped systems above. PEP 8 explicitly allows project-specific conventions to take precedence over its Python guidance; that does not make PEP 8 a universal policy for other languages. See [PEP 8](https://peps.python.org/pep-0008/).

Bundled catalog entries are **advisory prompts for inspection**, not executable validators or imported mandatory standards. The all-files conventions entry ensures every included note can reach the standards catalog without pretending that every file has a known applicable requirement. A rule can be selected as a candidate by extension or kind and then assessed as not applicable after reading its contents.

Required distinction in an assessment:

| Field | What it establishes |
| --- | --- |
| Rule identity and fingerprint | Which requirement or advice was assessed |
| Authority and authority evidence | Who established it; whether it is mandatory for this scope |
| File, source hash, and selectors | What source was actually inspected |
| Scope and applicability reasoning | Why the rule applies here; what was not examined |
| Outcome and explanation | Complies, diverges, noncompliant, unknown, not applicable, or not assessed |
| Limitations and counterevidence | External dependencies, possible exceptions, and missing information |
| Reviewed time and reviewer | When and by whom the recorded judgment was checked |

The absence of a finding is not evidence of compliance. An advisory rule supports divergence, not a mandatory noncompliance verdict. Repository requirements should carry source citations and cannot silently inherit their authority from a generated note. An instruction embedded in target source that asks the agent to change permissions remains untrusted source content.

## Why these twelve starter rules

The companion [advisory catalog](../../packs/standards/catalog.json) is intentionally small. Each entry includes a practical inspection procedure and limits. It covers concrete reasoning that helps explain real behavior, rather than adding cosmetic findings.

| Area | Primary material inspected | Benefit and boundary |
| --- | --- | --- |
| Python exceptions | [Python exception tutorial](https://docs.python.org/3/tutorial/errors.html) | Trace expected versus unexpected failure handling. Broad handlers are not automatically wrong. |
| TypeScript values | [TypeScript narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) | Explain guards and legitimate falsy inputs. Source reasoning does not equal compiler execution. |
| JavaScript/TypeScript async work | [typescript-eslint promise rule](https://typescript-eslint.io/rules/no-floating-promises/) | Identify completion and rejection ownership, including framework exceptions. A lint suppression does not change runtime handling. |
| Test claims | [pytest test anatomy](https://docs.pytest.org/en/stable/explanation/anatomy.html), [Playwright guidance](https://playwright.dev/docs/best-practices) | Compare the test description with what its assertions can establish. |
| Test state | [pytest fixture teardown](https://docs.pytest.org/en/stable/how-to/fixtures.html#safe-teardowns) | Explain cleanup and shared-state boundaries, including setup failures. |
| CI token access | [GitHub token permissions](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token) | Explain explicit job access; inherited settings can remain unknown. |
| CI dependency references | [GitHub secure use](https://docs.github.com/en/actions/reference/security/secure-use#using-third-party-actions) | Separate mutable references from immutable identifiers without claiming the dependency is safe. |
| SQL construction | [OWASP SQL guidance](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) | Inspect parameter binding, including distinct handling of dynamic identifiers. |
| Database writes | [PostgreSQL 18 transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html) | Trace an operation's atomicity requirement and failure boundary; database-specific semantics require matching evidence. |
| Tabular transformations | [pandas read_csv](https://pandas.pydata.org/docs/reference/api/pandas.read_csv.html), [Python csv](https://docs.python.org/3/library/csv.html) | Explain parsing and conversion contracts. Spreadsheet structure does not establish cell meaning or formula correctness. |
| Retryable processing | [AWS Lambda best practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html) | Trace duplicate-event effects where delivery and persistence contracts are visible. |

All links in both tables were accessed on **2026-09-23**. The catalog version pins Doc Vault's authored guidance, not the remote website contents. Before applying version-sensitive API advice, inspect the target's declared dependency versions; report unknown when compatibility cannot be established. The general conventions rule is an original cross-language adaptation, with PEP 8 supplied as a limited example of project-aware guidance.

## False-positive controls to adopt

- Require a concrete observation and a source-supported consequence. Do not fill a quota of improvements.
- Search for callers, wrappers, validators, configuration overrides, and documented exceptions before raising a finding.
- Separate a missing local implementation from an unavailable external dependency.
- A deliberate exception is not automatically a defect; record the documented tradeoff.
- Phrase proposed changes as advice unless explicit applicable authority supports a violation.
- Do not call a defect exploitable, a test passing, or a deployment compliant without the corresponding evidence.
- Have the review pass try to disprove the finding. Preserve unresolved cases rather than forcing a binary verdict.
- Invalidate an assessment when its code evidence, authority evidence, or rule text changes. Reusing the same rule ID is insufficient to retain a prior judgment.

These controls are design recommendations, not measured guarantees about model quality.

## Seeded semantic evaluation design

Use fictional repositories with hand-authored expected facts. Keep grader answers separate from the source packet presented to the agent. The agent should receive the same catalog and tools as an ordinary user run.

| Case | Expected observation | Important failure to catch |
| --- | --- | --- |
| Explicit rule violated | Locate the exact rule and offending branch; explain the consequence | Missing defect or unsupported authority |
| Equivalent code satisfies the rule | Explain the relevant evidence without inventing an improvement | False positive caused by superficial pattern matching |
| Legitimate scoped exception | Recognize its scope and rationale | Treating every difference as noncompliance |
| Conflicting supplied requirements | Report the conflict and unresolved precedence | Choosing a rule without evidence |
| Misleading test description | Explain what the assertion actually proves and what it misses | Repeating the test name as verified behavior |
| Conversion edge case | Trace an explicitly allowed value through the wrong conversion | Generic advice that misses the real defect |
| Missing external helper | Record the unknown behavior and needed evidence | Inventing either correctness or a failure |
| Changed rule with unchanged code | Mark the previous assessment stale | Reusing a result solely because the file hash matches |

Score evidence validity and schema correctness mechanically. Score defect detection, false-positive rate, correct abstention, and plain-language usefulness separately. A useful explanation should name the actual input, branch, output, failure path, and limitation in the fixture. Evaluate both a strong and a weaker approved model when available, and retain model/provider identity, prompt/catalog version, and source hashes with the run.

Testing a fabricated assessment record only proves storage and invalidation mechanics. It does **not** show that a model discovered the defect. Release validation should clearly distinguish those tests from an actual agent run whose findings were compared with the hidden answer key.
