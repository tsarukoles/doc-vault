# Practices and improvement assessment

Classify each assessment as a supplied requirement, an observed convention, or an advisory suggestion. Cite the source for a requirement. For an observed pattern, describe the inspected sample and known exceptions. Do not convert majority style into a mandatory policy.

## Responsibility and placement

Identify actual boundaries such as loading, validation, orchestration, transformation, presentation, and persistence. A placement concern needs evidence that responsibilities conflict with an explicit architecture rule or a stable local convention, plus a concrete consequence such as duplicated configuration or difficult testing. Folder names alone do not prove misplacement.

## Redundancy and duplication

Similar logic is a candidate for review. Compare callers, parameterization, failure behavior, side effects, and separate domain requirements before recommending consolidation. State the tradeoff: shared code can reduce repetition but increase coupling. A missing local reference is not proof of dead code when registries, dynamic imports, scheduled entry points, or external consumers exist.

## Robustness and traceability

Inspect exception handling, input validation, defaults, configuration ownership, rule identifiers, observable result semantics, and representative tests where relevant. Cite concrete paths and branches. Describe source-level concerns as such; no test execution or cloud inspection occurs in this workflow.

## Finding quality

Use one finding per coherent issue. Include observation, evidence, likely consequence, proposed improvement, uncertainty, and inspected scope. Avoid severity inflation and cosmetic quotas. Prioritize an issue only when its impact is supported. Do not expose sensitive values when explaining a configuration concern.

Documentation-quality checks are separate: broken links, stale evidence, unsupported claims, missing file coverage, and contradictory explanations belong in vault maintenance and review reports.
