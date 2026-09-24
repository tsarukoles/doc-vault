# File-note content template

Publish with `kind: file`, `slug: <exact primary source path>`, that path first in `source_paths`, and `review_status: draft`. The broker owns metadata, timestamps, identity, path selection, generated headers, and the standards assessment table. Supply evidence-backed explanations rather than a second handwritten metadata block or standards table.

**Title:** the source's useful name or repository-relative path.

**Summary:** one or two sentences explaining its verified role.

Use applicable sections; note material unknowns explicitly:

- **Purpose and boundaries:** what this file contributes, who uses it, and responsibilities owned elsewhere.
- **Important contents:** functions, classes, helpers, rules, tests, or configuration, with their roles and relationships.
- **Inputs, defaults, and outputs:** accepted shapes and meanings, configuration/environment, defaults, returned values, written artifacts, side effects, and result statuses.
- **Step-by-step behavior:** trigger and prerequisites followed by ordered operations, helper calls, loops/dispatch, branch conditions, early returns, and completion.
- **Checks and failure handling:** actual validations, exceptions, retries/timeouts, cleanup, partial results, reporting, and where to inspect a failure.
- **Tests and verification:** for test code, describe scenario → setup → action → actual assertion → cleanup. Identify mocks, parameterized cases, helper assertions, and what is not established. For production code, link inspected tests and qualify missing or uninspected coverage. Never claim tests were run.
- **Connections:** verified callers, dependencies, metadata/rules, downstream consumers, and links to related component/flow notes.
- **Issues and possible improvements:** source-backed observation, consequence, counterexamples or legitimate exceptions, proposed improvement, and remaining uncertainty. State when no substantiated issue was found within the inspected scope; do not invent findings.
- **Open questions and limits:** unresolved dynamic behavior, missing runtime context, unsupported formats, and uninspected branches.

Each substantive section needs exact source evidence. Use actual vault-note paths for wiki links, or plain source paths when no target exists. Define unfamiliar terms, prefer concrete actors and verbs, and explain complex behavior fully. Avoid repetitive boilerplate and line-by-line paraphrases. A simple file can be short; a complex test or transformation cannot be reduced to a generic one-line purpose.
