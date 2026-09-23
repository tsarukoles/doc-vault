# Synchronization

1. Read status, then call `vault_refresh`. Synchronization means local re-indexing and invalidation; it does not pull, push, or upload the ignored vault.
2. Inspect new, changed, deleted, and stale items returned by the broker. Use `invalidated_note_paths` and page through `vault_list` with `kind: notes`; entries with `needs_analysis` identify prior explanations requiring refresh even if a watcher already updated the static snapshot. Static `fresh: true` does not imply semantic completion. Do not invent a precise delta when no change list is available.
3. Read fresh packets for changed sources. Re-check semantic relationships and affected notes. A new hash without fresh analysis is not an updated explanation.
4. For deleted sources, use the broker's managed deletion/invalidation result. Do not restore an obsolete explanation as current. Preserve stable identities only when the broker provides them; ambiguous renames can remain delete/add events.
5. Revisit dependent flows, standards, onboarding, and profiles. Broader component re-analysis may be necessary when dependency coverage is incomplete. New entry points or capabilities trigger discovery again.
6. Publish supported replacements as drafts. Source or note changes invalidate prior review applicability. Run `vault_lint` and report any remaining stale or unresolved notes.

The optional watcher refreshes static state; it does not run a model or continuously rewrite semantic notes. Follow it with this skill to enrich affected explanations. Do not claim automatic model refresh outside an active, approved host session.
