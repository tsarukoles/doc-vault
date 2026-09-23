# Advisory-finding content template

Publish as `kind: finding`, with a safe descriptive slug, contributing `source_paths`, and `review_status: draft`.

**Title:** name the concrete issue without overstating certainty.

**Summary:** the supported observation and likely consequence.

- **Observation and scope:** what the inspected sources show, including counterexamples.
- **Basis:** supplied requirement, observed convention, or engineering suggestion.
- **Impact:** why the issue matters; distinguish demonstrated consequence from plausible risk.
- **Suggested improvement:** a specific change and relevant tradeoff, for later human consideration.
- **Uncertainty:** dynamic/external consumers, uninspected paths, or unavailable runtime evidence.

Do not prescribe code changes through this tool. Cite the passages supporting both the observation and any claimed standard. Similarity alone is insufficient for a definitive redundancy or dead-code claim.
