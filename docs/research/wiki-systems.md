# Research: codebase wikis and agent context systems

> Historical record: names and examples below describe earlier Doc Vault releases. Since 0.2.0, use EDW Doc and the current [team guide](../../GET-STARTED.md).

Research date: 2026-09-23. Scope: ideas useful to Doc Vault 0.1.1, whose runtime reads one approved repository, writes only its local ignored vault and the narrow root ignore-rule exception, and uses the host's model. This is a design review, not a benchmark of the listed products. No external implementation was installed, executed, or copied.

Primary project documentation and selected implementation files were inspected. Links use the projects' moving `main` branches unless stated otherwise; they document what was visible on the research date, not an immutable release audit. “Implemented” below means a matching code path was inspected, not that it was independently tested. “Documented” means the project describes the behavior but that particular runtime path was not verified.

## Findings and decisions

### 1. RepoAgent: explain a unit in its calling context

**Inspected:** the README, `repo_agent/chat_engine.py`, and `repo_agent/doc_meta_info.py`. Its prompt builder includes the analyzed object together with callers and callees, including their source and prior documentation. The metadata implementation stores a hierarchy and both directions of references; update logic compares caller sets and distinguishes changed code from newly added or removed referencers. These mechanisms are visible in code. Its README's automatic documentation/commit workflow is a separate product choice. [Prompt construction](https://github.com/OpenBMB/RepoAgent/blob/main/repo_agent/chat_engine.py), [metadata and update implementation](https://github.com/OpenBMB/RepoAgent/blob/main/repo_agent/doc_meta_info.py), [project workflow](https://github.com/OpenBMB/RepoAgent/blob/main/README.md).

**Adapt:** a file explanation should identify who invokes it, what it invokes, and why those relationships matter. Read the supporting sources; a neighboring generated note is navigation, not independent proof. Reconsider explanations when callers or relationships change, even if the file's own bytes do not.

**Reject for this tool:** staged-file changes and commit-oriented automation. Doc Vault's source-write boundary must remain intact. Do not generalize RepoAgent's Python-oriented object analysis into a claim that every language or runtime relationship is understood.

### 2. Aider: a small map guides deeper reading

**Inspected:** official repository-map documentation and `aider/repomap.py`. The implementation extracts definitions/references with tree-sitter, constructs a weighted graph, ranks it with PageRank, and selects a map within a token budget. Files and identifiers mentioned in the task influence selection. The code also caches tags using modification times. This is context selection for an editing assistant, not evidence that the resulting map completely describes runtime behavior. [Repository-map guide](https://aider.chat/docs/repomap.html), [map implementation](https://github.com/Aider-AI/aider/blob/main/aider/repomap.py).

**Adapt:** start each investigation with a compact map and retrieve relevant source in bounded packets. Prioritize entry points, shared dependencies, test assertions, and applicable configuration for the specific question. Preserve an inventory of unexamined files: relevance ranking must not make them disappear from coverage reporting.

**Defer:** a parser dependency and graph-ranking engine until measured failures justify their installation and maintenance cost. **Keep:** content hashes for evidence freshness; the cache strategy of an interactive map is not sufficient authority for a persistent reviewed claim.

### 3. DeepWiki-Open: ground the steps before writing the tour

**Inspected:** project README and `api/prompts.py`. The codemap prompts split work into a skeleton of ordered, source-referenced steps and a later prose/diagram enrichment phase. The first phase restricts paths and line references to supplied context and asks for fewer steps when evidence is insufficient. The second asks the model to retain the original step identities and citations. These are implemented prompt definitions; this review did not establish that every grounding rule is enforced by a validator. [Project overview](https://github.com/AsyncFuncAI/deepwiki-open), [codemap and research prompts](https://github.com/AsyncFuncAI/deepwiki-open/blob/main/api/prompts.py).

**Adapt:** establish a trace of input, action, condition, output, and failure handling before writing the friendly explanation. A test trace should cover setup, action, assertion, mocks, and cleanup. A flow diagram must describe the same supported steps as the prose.

**Reject:** treating an emphatic instruction as proof of accuracy. Doc Vault still needs mechanical source validation, an independent claim review, and explicit unknowns. Do not generate runnable-looking examples that imply unverified behavior.

### 4. FSoft-AI4Code CodeWiki: include operational files and update dependencies

**Inspected:** `artifact.py` plus artifact, incremental-update, and development guides. The artifact analyzer creates file nodes and bounded subunits for items such as pipeline jobs, package scripts, and container stages. It resolves references using lightweight format-specific logic; its guide expressly distinguishes these edges from a complete call graph. The guide also describes a fallback module for artifacts missed by model grouping. [Artifact analyzer](https://github.com/FSoft-AI4Code/CodeWiki/blob/main/codewiki/src/be/dependency_analyzer/analyzers/artifact.py), [artifact guide](https://github.com/FSoft-AI4Code/CodeWiki/blob/main/guides/artifact-aware-generation.md).

**Adapt now:** explicitly account for build, CI/CD, schemas, configuration, database definitions, transformations, and test infrastructure in coverage and explanation instructions. Files that resist grouping still need a visible home and coverage reason. This is particularly useful when the main process is encoded in metadata and configuration rather than a conventional application entry point.

Its update guide describes comparing saved/current component graphs, preparing reports for affected modules, scanning untouched pages for stale references, and recording decisions. This updater path was documented, not executed or source-audited here. [Incremental-update guide](https://github.com/FSoft-AI4Code/CodeWiki/blob/main/guides/incremental-updates.md).

**Adapt:** make stale decisions explainable and include changed relationships and standards sources as dependencies. Keep Doc Vault's conservative file/hash approach for this release. **Defer:** semantic component matching and automatic reclustering; false matches could preserve an incorrect explanation.

**Reject:** remote diagram rendering. The development guide says diagram validation contacts a rendering service; Doc Vault should not send repository-derived diagrams to another service. [Development guide](https://github.com/FSoft-AI4Code/CodeWiki/blob/main/guides/development.md).

### 5. PorunC CodeWiki: planning, evidence, publication, validation are separate

**Inspected:** README and usage guide, especially the agent-written wiki workflow. They document a deterministic page queue, bounded per-page evidence, separate save/validate commands, and a distinction between a draft and a page with valid source references. They also describe Obsidian export. These are documentation-level findings; the validator implementation and semantic accuracy were not independently audited. This project is distinct from the similarly named project above. [Project README](https://github.com/PorunC/CodeWiki), [agent-written wiki workflow](https://github.com/PorunC/CodeWiki/blob/main/docs/usage.md).

**Adopt as a design principle:** preserve separate states for inventoried, explained, mechanically valid, and independently reviewed. Give the agent a defined next unit of work and bounded evidence rather than a request to summarize everything at once.

**Keep the simpler local design:** Markdown, wiki links, structured records, and the existing broker are sufficient for the requested vault. **Defer:** GraphRAG, embeddings, a server, and a database. None is necessary to add stronger explanations or rule assessments, and each introduces a new maintenance burden.

### 6. CodeWikiBench: evaluate answers to requirements

**Inspected:** benchmark README describing repository/commit metadata, structured documentation, topic rubrics, and multi-model evaluation workflows. The project offers a useful evaluation pattern. Published scores are the project's own results; this review did not reproduce them or establish that its judge is suitable for Doc Vault. [Benchmark documentation](https://github.com/FSoft-AI4Code/CodeWikiBench/blob/main/README.md).

**Adapt:** use small, original, fictional repositories with human-written expected facts and forbidden claims. Score whether the vault explains the requested behavior and cites its evidence. Include a real violation, a valid exception, conflicting requirements, weak assertions, and an intentionally unknowable case. Record misses and false positives separately.

**Reject:** relying on the same model's overall approval, documentation length, or citation count as the only quality measure. A citation can resolve successfully while the sentence it supports is wrong.

## Application to Doc Vault 0.1.1

These are Doc Vault design decisions inferred from the comparison, not claims made by the external projects:

| Decision | Benefit | Acceptance evidence |
| --- | --- | --- |
| Require concrete file/test explanation sections | Replaces vague summaries with usable behavior descriptions | A newcomer can identify inputs, steps, branches, outputs, checks, and limits |
| Separate folder responsibilities from cross-file flows | Reduces repetition while preserving context | Folder notes link relevant files; flow notes cite each transition |
| Keep a dedicated standards specialist | Makes rule discovery and scope explicit | Every rule has authority, applicability, and a source/version |
| Store structured rule assessments | Enables trustworthy reverse links and refresh | File-to-rule and rule-to-file links come from the same records |
| Invalidate on code and standards changes | Prevents yesterday's verdict appearing current | Tests change a rule source while leaving assessed code unchanged |
| Preserve unknown and not-assessed results | Prevents a forced pass/fail answer | Missing evidence does not become a violation or a clean bill of health |
| Report coverage separately from correctness | Makes unfinished work visible | Included, skipped, explained, reviewed, and assessed counts stay distinct |
| Add semantic evaluation cases | Tests whether instructions find actual defects | Expected findings and false-positive traps are inspected independently |

The standards specialist must not convert an observed convention or generic recommendation into a mandatory project rule. Static inspection must not claim that tests passed, a migration succeeded, a deployment is safe, or a transformation produced the expected data. Those claims require evidence beyond merely reading the implementation.

## What this research does not establish

- No product was benchmarked against Doc Vault, and no star counts were used as quality evidence.
- No stronger model is guaranteed to solve inadequate evidence, incomplete readers, or vague acceptance criteria.
- No reviewed system proves that unrestricted agents or a large graph database are necessary for this release.
- The proposals above are not an implementation completion record. Release documentation and tests determine what actually shipped.
