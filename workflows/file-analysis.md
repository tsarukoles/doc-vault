# File analysis

Use `vault_packet` for the source path, snapshot hash, static facts, and candidate related sources. Read the relevant line ranges. Search literal identifiers only when an unresolved relationship requires it.

Establish the file's role from contents and actual callers/configuration, not its name alone. Explain its principal declarations, control decisions, inputs, outputs, and consequential dependencies. A short file may need only a few sentences. Do not paraphrase every line or invent intent for boilerplate.

Use `templates/file.md` to choose useful sections. Every substantive section carries evidence. Add other contributing paths to `source_paths`. For `kind: file`, set `slug` to `source_paths[0]`, the actual primary source path; the broker derives the managed note location and stable identity.

Record unsupported parsing and unresolved dynamic calls. Similar names, import proximity, or a search result are leads; inspect the relevant source before declaring a call, transformation, or rule dependency. Text extraction does not imply full language semantics.

Do not create dedicated notes for Markdown sources. They can support profile, component, standard, or onboarding notes. For unsupported binary files, rely only on the broker's explicit metadata and report that contents were not analyzed.

Before publishing, ask: Can a new engineer locate the implementation, understand the declared behavior, and see what remains uncertain? Remove speculative detail that does not help those outcomes.
