# Public distribution checklist

Use this before publishing a repository or release archive. This document does not publish anything.

## Content and rights

- Confirm every tracked source, fixture, document, image, and example is intended for public distribution.
- Remove private organization names, personal identifiers, internal repository addresses, secrets, credentials, customer data, and copied proprietary material.
- Use synthetic fixtures and clearly fictional examples. Review the actual staged diff and archive contents, including hidden files.
- Choose and include the intended license and verify the right to distribute every included asset. An unpublished npm package setting does not determine repository visibility or licensing.
- Exclude generated vaults, caches, test output, local configuration, and environment-specific paths.

## Package correctness

- Keep plugin and marketplace names, versions, source path, and documented commands consistent.
- Verify that the single-plugin marketplace points to `./` and that packaged skill/context resources are included.
- Verify Node.js 20-or-later support and the absence of undeclared runtime dependencies.
- Run the local tests and package checks. Record actual results and unresolved failures.
- Validate loading and the eight skills in a real supported Claude Code installation before claiming end-to-end host compatibility.

## Behavior and claims

- Confirm ordinary analysis writes remain within the generated vault and controlled `.gitignore` exception in tested scenarios. Exercise the separate setup allowlist, tracked-file fallback, repeat installation, user edits, and clean removal with maintenance disabled afterward.
- Exercise stale evidence, changed-note review, deletion, rename, invalid paths, and concurrent update handling.
- Verify the source-as-data instruction boundary with a synthetic instruction-injection fixture.
- Check that docs disclose lexical extraction, partial workbook support, provider processing, and host sandbox limits.
- Confirm automatic refresh claims describe static maintenance and a bounded active-session sync opportunity, not an unattended model service. Verify hooks in plan mode, with custom main agents, after external edits, and after an interrupted update.
- Do not claim human approval, security certification, production readiness, or exhaustive framework understanding from local tests.

## Release and updates

- Bump the distribution version and synchronize its manifest references.
- Describe concrete behavior changes and any migration or re-analysis needed for existing vaults.
- Test installation from the release artifact, not only a development folder.
- Follow the chosen hosting service's approval and publication process. Make the final release artifact reviewable before publishing it.
