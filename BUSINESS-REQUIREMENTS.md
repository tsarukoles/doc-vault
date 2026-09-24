# EDW Doc — Business Requirements

| Item | Description |
|---|---|
| Product | EDW Doc repository documentation plugin |
| Status | Draft for business review |
| Audience | Engineering teams, technical leads, standards owners, and platform teams |
| Purpose | Define the business need, required outcomes, boundaries, and acceptance criteria before making implementation choices |

This document is written as a pre-development business brief. It describes what the product must achieve; it does not claim that every requirement is implemented, tested, or approved. Current installation instructions and delivered capabilities are documented separately in [GET-STARTED.md](GET-STARTED.md), [known limitations](docs/limitations.md), and [validation records](docs/validation.md).

## 1. Business need

Understanding a repository takes time. Useful knowledge is spread across source files, configuration, tests, standards documents, and the people who have worked on the system. New engineers must piece this together, while experienced engineers repeatedly answer the same questions.

Documentation also falls behind the code. A useful explanation can become misleading after a file changes, a dependency is replaced, or a developer switches branches. Manually keeping every explanation up to date is difficult.

AI can help explain the repository, but a partial assessment presented as finished creates another problem: the team cannot tell what it can trust. Inventorying 446 files is not the same as understanding or assessing all 446 files.

The business needs a tool that performs a complete initial analysis, saves that knowledge, and updates the affected parts when the repository changes. Developers must remain free to continue working whether they choose to synchronize the documentation or not.

## 2. Desired business outcomes

- Help engineers find where behavior is implemented and understand it in simple words.
- Give new team members a practical reading and investigation path.
- Retain repository knowledge so the team does not pay to rediscover unchanged information on every run.
- Make documentation coverage, freshness, uncertainty, and outstanding work visible.
- Help teams assess declared standards consistently, with evidence for each conclusion.
- Support investigation and technical decisions without changing application code or interrupting development.
- Distribute and maintain the plugin through the team's shared collection of agentic tools.

The business accepts a higher model cost for the first complete sweep. Later synchronization must reuse valid work and focus spending on changes and their effects.

## 3. Users and their needs

| User | What they need |
|---|---|
| Engineer maintaining a repository | Understand files, execution paths, checks, failures, and the effects of changes. |
| New team member | Understand the repository's purpose, main components, prerequisites, and where to begin. |
| Technical lead or maintainer | See important relationships, documentation gaps, and evidence-backed improvement opportunities. |
| Standards owner | Trace a requirement to the files it applies to and inspect the reasons behind an assessment. |
| Plugin or toolkit maintainer | Install, distribute, update, and support a consistent product without losing users' knowledge. |
| Platform or security team | Keep repository access, model processing, and permissions within the organization's approved boundaries. |

## 4. Scope and guiding principles

The product covers a selected local repository, its supported source and configuration, its tests and pipelines, and relevant documentation and declared standards. Its output is a local, navigable knowledge folder, called the **vault**.

The core principles are:

1. **Analyze the full agreed scope.** Batching is acceptable; silently stopping early is not.
2. **Keep useful work.** Save completed analysis and reuse it while its evidence remains valid.
3. **Show what is known.** Separate supported conclusions, uncertainty, exclusions, and unfinished work.
4. **Follow the current checkout.** Keep one persistent vault and reconcile it with the files currently present.
5. **Keep development moving.** Documentation must never become a condition for coding, pulling, switching branches, committing, or pushing.
6. **Protect the repository and human notes.** Analysis is read-only except for the agreed documentation and narrow local setup work.

### What “complete” means

Every discovered file must be accounted for as included, excluded with a reason, or unsupported with a reason. Included reference material may support several explanations without needing a duplicate note for every document.

For each requested workflow, completion requires all its included work to be processed. Examples include explaining every eligible source file, assessing every applicable file-and-standard combination, or reviewing every claim in a requested full review.

The product must report these separately:

| State | Meaning |
|---|---|
| Complete | Required analysis was performed against the recorded evidence. |
| Assessed with unresolved questions | Evidence was inspected, but a conclusion cannot be reached; the reason and missing evidence are recorded. |
| Pending or not assessed | Required work has not been performed. |
| Blocked | Required work cannot continue; the obstacle and next action are recorded. |
| Stale | Earlier work exists, but relevant evidence has changed. |
| Excluded or unsupported | Material is outside the declared analysis scope or cannot be interpreted; the reason remains visible. |

An unresolved question is not a pass. An unread file is not an unresolved assessment. Excluded and unsupported files must not be counted as successfully analyzed. A workflow with pending, blocked, or stale required work must not be labeled complete. A completed workflow with unresolved questions must say so explicitly.

## 5. Functional requirements

All requirements in this section are required for business acceptance unless explicitly marked optional. They define outcomes rather than prescribing a particular implementation.

### BR-01 — Discover and explain the scope

Before analysis, the product must identify the selected repository, the intended outputs, applicable exclusions, and supported file types. It must make the scope understandable and allow an explicit narrower request when needed.

All discovered material must remain accounted for. Large files, unfamiliar formats, inaccessible files, and model limits must not cause silent omissions. Exclusions must be visible before a completion claim and must not be added merely to make the coverage number look complete.

### BR-02 — Perform a full initial sweep

The initial workflow must inspect all eligible material needed to explain the repository's purpose, meaningful files, components, relationships, and principal flows. Standards assessment must cover all applicable files and rules when requested.

No default file quota, representative sample, time limit, or token allowance may silently turn a full request into a partial one. A user-selected limit may pause the work, but the result must remain visibly unfinished.

The team must have a clear path to a complete baseline, with a consolidated status across documentation, standards assessment, and requested review. The user must not need to discover omissions manually and repeatedly ask the model to “do the rest.” Separate workflow steps are acceptable if their completion and remaining work are clearly tracked.

### BR-03 — Save progress and resume reliably

The product must save completed work and the remaining queue throughout long runs. Context limits, session closure, cancellation, provider failure, or an interrupted write must not require a fresh sweep of unchanged, completed material.

Within a valid authorized run, it must continue through the necessary batches. If continuation needs a new session or approval, it must report that clearly and resume from saved progress. Saved progress does not imply saved permission.

### BR-04 — Produce useful, readable explanations

Explanations must use plain language and provide enough detail for an engineer unfamiliar with the repository. Where relevant, they must cover purpose, inputs, outputs, main steps, important decisions, dependencies, validation, and failure handling.

Tests must be explained from their actual checks and supporting logic. Names, comments, imports, or folder locations alone are not sufficient proof of behavior. Detail must match complexity; a complex process must not receive only a generic one-line description.

### BR-05 — Connect files, processes, and onboarding

The vault must provide navigable repository and component maps, linked file explanations, process walkthroughs, and onboarding guidance. Diagrams should be used where they help explain a supported flow.

Users must be able to move from an overview to relevant details and source evidence. External systems, unresolved relationships, and unknown process steps must be labeled rather than invented.

### BR-06 — Assess standards with clear authority

The product must distinguish declared requirements, observed conventions, and advisory recommendations. It must record which rules apply to which files, the supporting evidence, the assessment date, and the reason for each outcome.

Results must distinguish compliance, demonstrated noncompliance with a declared requirement, divergence from a convention or recommendation, insufficient evidence, not applicable, not assessed, and stale. Advisory guidance must not become mandatory merely because the plugin includes it.

Users must be able to navigate from a file to its applicable rules and from a rule to its assessed files. Coverage must show the applicable file-and-rule combinations, not only the number of files discovered.

### BR-07 — Synchronize changes and their effects

Synchronization must compare the current repository contents with the evidence used for saved analysis. It must detect added, edited, deleted, and renamed files, including uncommitted changes; relying only on the current branch name or latest commit is insufficient.

When a rename cannot be established reliably, the product may treat it as a deletion and an addition, disclose the uncertainty, and preserve the old annotations rather than attach them to a guessed replacement.

It must update affected file notes, relationships, maps, process explanations, onboarding material, findings, and standards assessments. Changes to shared helpers, configuration, rules, rule authority, or rule applicability must trigger reassessment of dependent conclusions where relevant.

Unchanged, still-valid analysis must be retained. A lightweight comparison of the repository is acceptable; repeating the full AI analysis without a reason is not. Where impact cannot be determined reliably, the product must explain why a broader reassessment is needed.

Previously reviewed material must lose its current review status when the reviewed content or supporting evidence changes. If refreshed review is outside the requested sync scope, it must remain visibly pending rather than inheriting the old approval.

### BR-08 — Keep one persistent vault across branch changes

The product must maintain one local vault for the checkout. Switching branches must not require separate branch vaults, discard accumulated knowledge, or restore a hidden documentation snapshot.

Changing branches alone must preserve the vault's contents. When a change is detected, retained explanations that no longer match the checkout must be marked accordingly. After synchronization, files absent from the checkout must no longer appear as current source. Their generated notes must remain as clearly retired or historical material unless the user explicitly requests cleanup, and personal annotations must be preserved. Confirmed renames must update active links without leaving duplicate current entries.

Example: an engineer builds the vault on `main`, switches to a feature branch, adds files, and synchronizes them. After returning to `main`, the vault remains. The next reconciliation identifies the difference, and sync updates the current view for `main`. The branch-only explanations may remain for reference, clearly separated from current documentation.

### BR-09 — Remind or synchronize without blocking development

An enabled local integration must detect relevant changes following a Git pull or branch switch and provide a nonblocking next action. Source edits and updates received through other means must also be detected during reconciliation.

| Situation | Required behavior |
|---|---|
| User explicitly requests sync | Analyze the detected changes under the approved command scope. |
| Model is connected and automatic sync is explicitly enabled and authorized | Start or queue the affected analysis without blocking the Git operation or normal coding. |
| Model is unavailable, automatic sync is disabled, or authorization is absent | Show a reminder with the exact action: `Don't forget to sync EDW Doc: /edw-doc:sync`. |
| Git runs outside an active model session | An enabled Git or terminal integration must be able to show the reminder without needing a model connection; explain that the command is run inside Claude Code with the plugin loaded. |
| User ignores the reminder, declines analysis, or analysis fails | Preserve progress and allow development to continue normally. |

Automatic AI sync is an optional mode and must be explicitly enabled. Reminder-only use must remain available. Repeated events for the same outstanding changes should not flood the terminal or start duplicate runs. New edits during a running sync must remain tracked for subsequent processing.

The installed trigger's coverage must be disclosed. If a required integration is disabled or unavailable, status must report that condition and the next supported checkpoint must reconcile the checkout. An active-session-only check must not be described as providing immediate reminders while the host is closed.

### BR-10 — Ask for approval once per explicit command

Each `/edw-doc:*` command must clearly identify its scope and obtain one normal plugin operation approval. That approval must cover permitted repository reads and expected vault writes throughout the command, including its batches and delegated work. Routine per-file or per-batch permission prompts must not be required.

The approval must end when the run finishes or is cancelled. Out-of-scope access must remain unavailable; the solution must not depend on globally disabling permission checks. Initial host trust, provider authentication, and stricter organizational policies are separate prerequisites and must be explained in the team guide.

Optional automatic sync must use a separately enabled, bounded authorization. Being connected to a model alone is not permission to spend tokens or begin a new analysis.

### BR-11 — Preserve source, configuration, and human notes

Ordinary analysis must not modify application source, execute repository scripts or tests, change Git history, or perform deployment actions. Writes must be limited to the managed vault and disclosed local setup needs, such as narrowly scoped ignore entries and plugin-owned integration files.

Setup, updates, and removal must preserve existing instructions, settings, hooks, tracked files, and unrelated configuration. The product must identify its own content rather than treating an entire folder as disposable.

Personal annotations must survive rebuilding, synchronization, source deletion, branch changes, and upgrades. If a user edits a generated note, the product must detect the conflict and avoid silently overwriting the edit.

### BR-12 — Make evidence and quality visible

Important factual claims must link to inspectable source evidence and identify the revision or contents used. Changed evidence must invalidate affected claims' freshness and review status.

The product must check broken links, missing evidence, and inconsistent records. It must also support a separate review of claims against source. A full review must cover its entire declared scope; a sample is allowed only when explicitly requested and labeled as partial.

Mechanical checks, AI review, and human approval must be distinguishable. Static analysis must not be presented as an executed test, observed production behavior, or compliance certification.

### BR-13 — Answer repository questions and support investigation

Users must be able to ask questions about the repository and request onboarding guidance or advisory findings. Answers must identify relevant files, use available evidence, and disclose gaps or stale information that affect the answer.

Findings may suggest improvements, but the analysis workflow must not apply source fixes. A focused question does not imply a full-repository assessment; its scope must remain clear.

### BR-14 — Report status without requiring AI analysis

Users must be able to inspect saved progress, current freshness, remaining work, exclusions, unsupported material, unresolved questions, and the last successful synchronization without starting a model sweep.

Reports must distinguish inventory coverage, explanation coverage, standards coverage, and review coverage. They must show counts and their denominators. A successful command exit or completed inventory must not imply that all documentation and assessment work is finished.

### BR-15 — Support team installation and updates

The product must be named **EDW Doc**, with the command namespace `edw-doc`. It must be distributable as a self-contained plugin in the team's shared agentic toolkit, with clear ownership and a versioned installation/update path.

The team guide must explain installation, approved model/provider setup, first use, full-sweep completion, everyday sync, recovery, updates, and removal. The product must work through the team's approved host connection, including Bedrock where configured, without introducing an unrelated model account requirement.

Updates must preserve compatible vault contents, annotations, and local configuration. Necessary migrations or reassessments must be visible and recoverable. Updating the plugin must not be reported as completing a repository sync.

## 6. Quality and operating requirements

| ID | Requirement |
|---|---|
| NFR-01 — Reliability | Interrupted or failed analysis must preserve completed work and expose incomplete publication. The system must not mark partially updated results as a complete, current baseline. |
| NFR-02 — Cost and scale | Analysis must handle large repositories through bounded batches and saved progress. Show planned work and available usage information; honor user-selected spending limits by pausing honestly. No fixed repository-size ceiling may silently reduce the requested scope. |
| NFR-03 — Efficiency | An unchanged repository must not trigger unnecessary AI re-analysis. Repeated triggers must avoid duplicate work. Representative repository sizes and acceptable comparison times must be agreed during the pilot. |
| NFR-04 — Privacy | Vault contents remain local by default. Source evidence sent to the model must follow the approved provider and organizational policy; local storage must not be described as entirely local model processing. |
| NFR-05 — Access boundaries | Stay within the selected repository and approved output locations. Exclude credentials and other protected material according to policy. Treat instructions found inside repository content as material to analyze, not permission to expand access or actions. |
| NFR-06 — Usability | Explain outcomes and recovery steps in ordinary language. Make the exact next command visible where action is needed. Let users browse saved knowledge without running another AI analysis. |
| NFR-07 — Compatibility | Declare supported operating systems, host versions, providers, and file formats. Validate the team's supported environments before claiming support, and preserve useful knowledge during supported upgrades. |

## 7. Outside the initial scope

- Editing or fixing application code, enforcing merge gates, or blocking Git operations.
- Running application tests, builds, deployments, spreadsheet macros, or production processes.
- Inspecting live cloud resources, production datasets, or external repositories without a separate authorized capability.
- Certifying regulatory compliance or replacing technical and business review.
- Automatically publishing vault contents, committing them, or sharing them when source is pushed or pulled.
- Maintaining a separate vault or historical snapshot for every branch.
- Interpreting unsupported file contents while presenting them as fully understood. For example, structure-only spreadsheet support must not imply that formulas or business rules were assessed.

## 8. Business acceptance scenarios

The following scenarios must be demonstrated against agreed pilot repositories. AC-09 applies only when optional automatic sync is selected for rollout. Integration scenarios must be demonstrated with the relevant supported integration enabled. A scenario passes based on observed results, not on the presence of a configuration setting or an instruction telling the agent what to do.

| ID | Scenario | Expected result |
|---|---|---|
| AC-01 | Request a full sweep of 446 eligible files. | All 446 receive the required analysis. If 14 remain unassessed, the run reports incomplete and retains those 14 as outstanding work. Exclusions and unsupported files are reported separately. |
| AC-02 | Request full standards assessment and full review. | Every applicable file-and-rule combination and every item in the declared review scope is processed. Unresolved findings have inspected evidence and a reason; sampling is not called complete. |
| AC-03 | Interrupt a sweep halfway and resume. | Valid completed work remains. Processing continues with unfinished or newly invalidated work after any required renewed run approval. |
| AC-04 | Synchronize an unchanged checkout. | The comparison reports no relevant changes and does not repeat AI analysis of valid material. |
| AC-05 | Add, edit, delete, and rename files, including uncommitted changes, then sync. | Affected notes and references update; deleted files leave the current view; confirmed renames do not create duplicate current entries; uncertain matches are disclosed and safely treated as deletion plus addition; annotations survive. |
| AC-06 | Change a shared helper or a declared standard without editing its consumers. | Affected downstream explanations or assessments become stale and are refreshed as required. Unrelated valid work is retained. |
| AC-07 | Build on `main`, document new feature-branch files, then return to `main`. | The same vault remains. Once the change is detected, branch-only material is flagged. After sync, the current view matches `main` and retained historical notes are clearly identified. |
| AC-08 | Pull or switch branches with the enabled terminal integration while the model host is closed or disconnected. | Git completes normally and the terminal gives the EDW Doc sync reminder with the command and where to run it. No model access is needed to show the reminder. |
| AC-09 | Trigger authorized automatic sync, then make more edits while it runs. | Development continues; duplicate runs are avoided; later changes remain tracked; failure does not fail Git or discard saved progress. |
| AC-10 | Run a large command across multiple batches. | One normal plugin operation approval covers permitted work. Routine reads and vault writes do not repeatedly prompt. Cancellation ends that authorization. |
| AC-11 | Decline sync, exceed an agreed spending limit, or lose the provider connection. | Coding and Git remain usable. Status clearly shows unfinished work, saved progress, and the next action. |
| AC-12 | Edit an annotation and a generated note, then sync or upgrade. | The annotation survives; the generated-note conflict is reported without silently overwriting the user's edit. Existing unrelated configuration remains intact. |
| AC-13 | Follow a claim to source, then change that source; also attempt a write outside permitted locations. | Evidence can be inspected, the previous freshness/review claim is invalidated, and the unauthorized write is rejected. Application source remains unchanged. |
| AC-14 | Ask a new engineer to explain a main flow and locate its validation and failure handling. | The engineer can follow the guide to relevant files and evidence, distinguish unknowns, and complete the agreed pilot task without relying on the tool author. |
| AC-15 | Install and update through the team's distribution route. | Documented commands work in supported team environments, the correct plugin version is identifiable, and existing compatible knowledge and local configuration are preserved. |

## 9. Measures of success

Acceptance requires:

- All discovered files accounted for, with transparent scope and exclusion reasons.
- Zero pending, blocked, or stale required items whenever a full workflow is labeled complete.
- Separate, accurate totals for explanations, applicable standards assessments, and requested reviews.
- No unnecessary repeat AI analysis in the unchanged-repository acceptance scenario.
- One normal plugin operation approval per explicit command in the supported host configuration.
- No unauthorized source changes, lost personal annotations, or development operations blocked by sync.
- Successful interruption recovery, branch reconciliation, and addition/deletion/rename handling.

The pilot should also measure time to complete agreed onboarding and investigation tasks, initial sweep time and cost, incremental sync time and cost, and the number of manual interventions. Baselines and improvement targets must be agreed with the pilot team; no productivity percentage or cost saving is assumed in advance.

## 10. Dependencies and decisions before rollout

| Topic | Required agreement |
|---|---|
| Repository scope | Pilot repositories, supported formats, exclusions, sensitive material rules, and what constitutes a meaningful explanation. |
| Standards authority | Which documents contain mandatory requirements, who owns them, and how conflicting or missing requirements are resolved. |
| Automatic sync | Whether the team enables it, the authorization and spending boundaries, and the supported terminal/Git trigger mechanism. Reminder-only use must remain available. |
| Host and provider | Supported Claude Code versions, approved providers including Bedrock where used, and any organization-enforced permission behavior. |
| Knowledge ownership | Owners of generated documentation and annotations; any future approved sharing process beyond the default local vault. |
| Distribution and support | Placement and ownership in the shared toolkit, release responsibility, upgrade process, and support contact. |
| Pilot acceptance | Representative repository sizes, quality review tasks, performance expectations, and named business and technical approvers. |

Business acceptance requires evidence that the mandatory scenarios pass, review of unresolved findings and exclusions, and confirmation from the responsible business and technical owners. Any exception must be recorded with its impact and agreed scope; an implementation limitation must not silently redefine a requirement.
