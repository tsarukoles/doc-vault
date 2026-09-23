# Example data controls

This synthetic repository demonstrates a small, configuration-driven validation
pipeline. `application/handler.py` accepts records, `application/runner.py`
selects checks from a registry, and `application/rules.py` implements the checks.

`config/rules.csv` is a human-readable example rule catalog. The handler uses
explicit control names by default. If input includes `catalog_path`, the metadata
reader loads enabled rule identifiers from that path and the runner resolves them
through the Python registry. The catalog filename is chosen by the caller;
documentation must distinguish that configuration-dependent connection from a
hardcoded default.

## Vocabulary

- A **control** is a validation against one incoming record.
- A **stage** is a named boundary in the example pipeline.
- A **finding** contains the failing rule name and record identifier.

No cloud account, external database, credentials, or production data is needed.
