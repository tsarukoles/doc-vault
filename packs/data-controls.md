# Metadata-driven data-control lens

Apply when evidence connects metadata or rule definitions to executable checks and reported outcomes. A spreadsheet and a function named `validate` are only discovery signals.

## Trace the control lifecycle

Rule source → loader/parser → normalization and validation → dispatch or check implementation → dataset/partition selection → evaluation → status aggregation → result storage/reporting.

Establish the control identifier, check type, parameters, thresholds/tolerances, severity, activation condition, and output status only where source supports them. Distinguish a control definition from an individual execution. Explain how metadata selects behavior rather than merely listing columns.

Separate these outcomes when the source does: failed control, malformed rule, missing dataset, empty input, unsupported check, execution exception, and skipped control. Do not collapse them into one failure type. Identify default behavior and exception paths.

## Pipeline and infrastructure boundaries

Connect declared triggers and handlers to orchestration, transformation, storage references, and result handling. For serverless functions or data-lake resources, source can establish declarations and identifiers; deployed permissions, actual lineage, current contents, and successful execution remain unknown without a separately authorized operational source.

Inspect date/partition selection, schema expectations, late-arriving data, retry behavior, and idempotency where implemented. Do not infer these properties from a service name. A configured retry is not proof that repeated writes are safe.

## Tabular evidence

Use extracted content only when supplied by the broker. CSV is structured text: quoted delimiters, multiline fields, blank values, and leading-zero identifiers can change meaning. Do not silently coerce identifiers or invent missing values. Cite the actual returned line representation.

The workbook reader provides bounded structural metadata: available sheet names, cell addresses/types, stored-cell counts, and formula-cell counts. Cell values and formula expressions are omitted. Use its exact workbook/sheet/cell selectors for structural claims only. Stored-cell counts are not rule counts, and a formula-cell count does not reveal formula behavior.

If a workbook or other binary format cannot be inspected, state that limitation. A filename cannot substantiate sheet names, columns, formulas, control counts, or rules. Semantic workbook analysis would require additional approved extraction and provenance; do not fabricate line evidence or values for unseen cells.

## Change impact

Rule-definition changes affect linked control notes and outcome explanations. Loader/schema changes can affect every rule it interprets. Check implementation changes affect all linked definitions. Dataset naming, partition selection, orchestration, and deployment declarations affect relevant flow boundaries. If those links are unresolved, broaden the affected component analysis rather than promising precise impact.

Useful output: a metadata-to-implementation map, a control execution flow, and a status/failure interpretation guide with explicit unresolved boundaries.
