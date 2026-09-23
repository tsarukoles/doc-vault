# Source-grounded questions

Use `vault_status` first. If the vault does not exist, explain that a build is needed; do not initialize during a read-only question. If it is stale, identify that condition and use available broker-approved current source to qualify the answer, or request a sync when current evidence is unavailable.

Find candidate notes through inventory and `vault_note`; locate supporting source with bounded literal search and packets. Read the passages necessary to answer. Generated prose is a navigational aid, not independent evidence.

Answer the actual question, cite repository-relative source paths and line ranges, and identify important uncertainty. For causal or operational questions, separate local declared behavior from runtime facts unavailable in the repository. Never fabricate logs, deployed settings, test outcomes, or execution traces.

Saving an answer requires an explicit user request. When requested, publish an appropriate structured note with current source evidence; do not treat a conversational answer as implicitly reviewed.
