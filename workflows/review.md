# Separate evidence review

Select requested notes or declare a bounded sample. Prioritize purpose claims, consequential flow edges, standards findings, and recently changed notes. Read `vault_note` and retain its returned `{path,text,sha256}`.

For each important claim:

1. Inspect the original cited source using `vault_packet` and `vault_read`.
2. Check that the passage supports the precise wording and conditions, not merely a related topic.
3. Look for relevant contradictory branches or configuration where the claim is broad.
4. Check that inferred relationships and operational unknowns are labeled.
5. Record the actual inspected scope and gaps.

Use `vault_review` with `note_path`, `expected_note_sha256`, `verdict`, `reason`, and current `evidence` locators. Verdict meanings:

- `supported`: the inspected substantive claims are supported within the stated scope; this is an agent evidence review.
- `needs-revision`: a material claim is contradicted, overstated, or missing necessary qualification.
- `unresolved`: available evidence or supported extraction cannot determine a material claim.

Pass the exact note hash returned by `vault_note`; do not compute or guess it. A changed note or source requires rereading before a new verdict. Do not relabel a partial sample as a complete vault review. Report material unresolved claims even if other claims are supported.

The reviewer does not publish corrections. Return precise findings that the curator can address in a later sync or build. Publication remains draft until a separate current review record exists; no state means human approval.
