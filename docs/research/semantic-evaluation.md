# Semantic evaluation procedure

This evaluation answers a narrow question: can an agent distinguish a demonstrated defect, correct behavior, an allowed exception, and insufficient or conflicting evidence in small fictional repositories?

The six cases cover a boundary comparison, parameterized SQL, a CI exception, a weak browser-test assertion, an external processing helper, and conflicting transformation requirements. The fixtures are inert source material. Neither the packet builder nor grader imports or executes them.

## Separation of inputs and answers

- `evaluations/fixtures/` contains only fictional repository files.
- `evaluations/suite.json` contains tasks and assigned rule IDs, without expected outcomes.
- `evaluations/rubric.json` is the answer key and human-review rubric. Do not expose it to the evaluated agent.
- `scripts/evaluate.mjs packet` supplies tasks, sources, hashes, the advisory catalog, and the required output shape. It omits the answer key.
- `scripts/evaluate.mjs grade` checks a completed prediction file against the hidden rubric.

Use a fresh agent context that cannot read the grader or rubric. A reviewer who already saw the answer key cannot provide a blinded evaluation run. Keep the output JSON, source packet, model/provider identity, and run date together for reproducibility. Record identity as unknown when the host does not reveal it; do not guess it.

## Run

From the plugin directory:

```bash
node scripts/evaluate.mjs packet > /path/outside-plugin/packet.json
```

Give that packet to an approved agent, ask it to follow the embedded output contract, and save its unmodified JSON as `predictions.json`. A single case can be emitted with `packet minimum-count`, but the full-suite grader expects all six cases.

```bash
node scripts/evaluate.mjs grade /path/outside-plugin/predictions.json
```

The grader writes its report to standard output and returns failure if a deterministic assertion fails. It does not write to the plugin or fixture directories. Paths above are placeholders for a reviewer-owned temporary directory.

## What the report establishes

Deterministic checks cover one prediction per case, expected classifications, the assigned rule, source hashes, valid source line ranges, and intersection with required source anchors. A range intersecting an expected anchor does not prove the agent interpreted it correctly.

The report also supplies the human-review rubric. A reviewer must check that the explanation identifies the actual inputs, comparison or assertion, outcome, and limitation. Inspect each claimed defect and each claimed absence of a defect. Record false positives, missed defects, and correct abstentions separately.

A hand-built prediction object passing the grader tests **the grader**. It is not evidence of model performance. A genuine agent run passing classification checks still requires explanation review and does not establish accuracy on large repositories. The small suite does not measure exhaustive code coverage, runtime test success, security completeness, or external service behavior.

## Release use and known gaps

Run the suite after changing discovery, standards instructions, evidence handling, or review prompts. Compare results with the previous prompt/catalog/model combination. Preserve failures rather than rewriting the expected answers to match model output. Change an expected answer only after an independent reviewer shows the fixture contract or rubric was wrong.

This version provides deterministic grading and human rubrics, without adding provider credentials or a new hosted evaluation service. Broader language coverage, long-context multi-file cases, empirical latency/cost measurements, and a repeated-run false-positive estimate remain future work. Real repository evaluation should use approved, sanitized examples and independently established expected facts.

The first [0.1.1 exercise](evaluation-v0.1.1.md) exposed an undefined meaning for `finding`. Packet contract 1.1 now defines it as an implementation issue under the assigned rule; policy conflicts remain explicit in the rationale. The original packet, predictions, score, and independent adjudication remain available rather than being retroactively corrected.

Validation of an actual model run must be recorded separately, including its source packet hash, declared model/provider, results, reviewer, and limitations. This document alone makes no claim that a model has passed the suite.
