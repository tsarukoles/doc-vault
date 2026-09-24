# Version 0.1.1 source-analysis exercise

An agent inspected six fictional cases using the bundled analysis/standards guidance and a packet containing the source, hashes, tasks, and result format. It was instructed not to read the answer key, grader implementation, tests, or other predictions. The original output has been preserved without correction.

## Recorded result

- Deterministic classification matches: **5 of 6**.
- Valid required evidence checks: **6 of 6**.
- A separate agent reviewed all six rationales against the sources and qualitative rubric and found them consistent with that rubric. This was an **agent review, not human approval**.
- The one mismatch was the meaning of the `finding` field. Both the agent and rubric gave `result: unknown` for conflicting transformation requirements. The agent used `finding: present` for the definite policy inconsistency; the rubric expected `finding: unknown` for an implementation violation that cannot be established without policy precedence.

The original packet did not define which type of finding the field meant. An independent reviewer confirmed that this was an ambiguous evaluation contract, not demonstrated incorrect source reasoning. The score remains **5/6**; neither the predictions nor the answer key was changed to make it pass.

The next packet format, evaluation contract 1.1, explicitly defines `finding` as an implementation issue under the assigned rule. Policy conflicts belong in the explanation while unresolved implementation compliance remains unknown. That clarified format has not been rerun as a fresh blind exercise in this release.

## Artifacts

- [Original source packet](../../evaluations/results/independent-v011.packet.json)
- [Raw predictions](../../evaluations/results/independent-v011.json)
- [Original deterministic report and packet fingerprint](../../evaluations/results/independent-v011.grade.json)
- [Procedure and future-run requirements](semantic-evaluation.md)

The declared provider was OpenAI; the agent recorded the exact model as unknown. Its declared timestamp is retained as submitted, not independently verified. It had previously authored the instruction layer but had not inspected the answer key or grading results. A fresh-context spawn was unavailable, so this is a separate-answer exercise with that limitation, not a fully blind benchmark.

No fixture code, project tests, cloud calls, Claude Code host integration, or Bedrock requests were executed in this exercise. It measures a small source-analysis task and does not establish accuracy on an unseen large repository or every supported model. A qualified human should inspect the examples and repeat the exercise with the intended host/model before drawing broader conclusions.
