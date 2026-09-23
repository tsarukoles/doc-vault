const MAX_LIST = 200;
const yaml = (value) => {
  const serialized = JSON.stringify(value ?? null);
  // Source paths may literally contain wiki-link delimiters. Keep scalar
  // metadata lossless without turning the raw Markdown into navigation.
  return typeof value === 'string' ? serialized.replace(/\[/g, '\\u005b').replace(/\]/g, '\\u005d') : serialized;
};
const code = (value) => `\`${String(value ?? '').replaceAll('`', "'").replace(/[\r\n]/g, ' ')}\``;
const plain = (value) => String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/[<>]/g, '').replace(/([\\`*_[\]#|])/g, '\\$1');

export function notePath(sourcePath) {
  const segments = String(sourcePath).replaceAll('\\', '/').split('/').filter(Boolean);
  const safe = segments.map((segment) => {
    if (segment === '.' || segment === '..') return segment.replaceAll('.', '%2E');
    let encoded = segment.replace(/[%#|^\[\]:?*"<>\x00-\x1f]/g, (character) => `%${character.codePointAt(0).toString(16).toUpperCase().padStart(2, '0')}`);
    if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(encoded)) encoded = `%${encoded.charCodeAt(0).toString(16).toUpperCase()}${encoded.slice(1)}`;
    return encoded.replace(/[. ]+$/, (suffix) => [...suffix].map((c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`).join(''));
  });
  return `files/${safe.join('/')}.md`;
}

function wiki(target, label) {
  const name = target.replace(/\.md$/, '');
  return `[[${name}${label ? `|${String(label).replace(/[\[\]|\r\n]/g, ' ')}` : ''}]]`;
}

function sourceLink(sourcePath, outputPath, label) {
  const depth = outputPath.split('/').length;
  const target = '../'.repeat(depth) + sourcePath.split('/').map(encodeURIComponent).join('/');
  return `[${plain(label || sourcePath)}](<${target}>)`;
}

function bullets(items, empty = 'No supported evidence was extracted for this section.') {
  return items.length ? `${items.map((item) => `- ${item}`).join('\n')}\n` : `${empty}\n`;
}

function limited(items, cap = MAX_LIST) {
  const result = items.slice(0, cap);
  if (items.length > cap) result.push(`… ${items.length - cap} more entries are recorded in the structured index.`);
  return result;
}

function table(headers, rows) {
  const cell = (s) => String(s ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
  return `${headers.map(cell).join(' | ')}\n${headers.map(() => '---').join(' | ')}\n${rows.map((row) => row.map(cell).join(' | ')).join('\n')}\n`;
}

function locator(ev) {
  if (ev.selector?.sheet) return `${ev.path} · sheet ${ev.selector.sheet}${ev.selector.cell ? ` · cell ${ev.selector.cell}` : ''}`;
  if (ev.start_line) return `${ev.path}:L${ev.start_line}${ev.end_line && ev.end_line !== ev.start_line ? `–L${ev.end_line}` : ''}`;
  return ev.path;
}

export function renderAnalysisIndex(state) {
  const entries = Object.entries(state.enrichments || {});
  const dates = [state.snapshot?.created_at, ...entries.map(([, entry]) => entry.analyzed_at), ...entries.map(([note]) => state.reviews?.[note]?.reviewed_at)].filter(Boolean).sort();
  const updated = dates.at(-1) || null;
  const groups = new Map();
  for (const [note, entry] of entries) {
    const kind = entry.kind || 'other';
    if (!groups.has(kind)) groups.set(kind, []);
    const review = state.reviews?.[note];
    const exactReview = review?.note_sha256 === state.generated?.[note];
    const reviewLabel = exactReview ? `agent review: ${review.verdict}` : 'separate agent review pending';
    groups.get(kind).push(`${wiki(note, note.replace(/\.md$/, ''))} — ${plain(reviewLabel)}; analyzed ${code(entry.analyzed_at || 'unavailable')}.`);
  }
  const pending = Object.keys(state.needs_analysis || {});
  if (pending.length) groups.set('Needs fresh analysis', pending.map((note) => wiki(note, note.replace(/\.md$/, ''))));
  const order = ['Needs fresh analysis', 'onboarding', 'profile', 'component', 'flow', 'file', 'standard', 'finding', 'other'];
  const sections = [...groups].sort(([a], [b]) => (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b))).map(([kind, items]) => `## ${plain(kind)} notes\n\n${bullets(items.sort())}`).join('\n');
  const totalSources = (state.records || []).filter((record) => record.status === 'included').length;
  const explainedSources = new Set(entries.filter(([, entry]) => entry.kind === 'file').map(([, entry]) => entry.source_paths?.[0]).filter(Boolean)).size;
  return `---\ntype: analysis-index\nanalysis_level: navigation\nplugin_version: ${yaml(state.version || null)}\nsnapshot: ${yaml(state.snapshot?.id || null)}\nupdated_at: ${yaml(updated)}\n---\n\n# Agent explanations\n\nThis index lists current agent-generated explanations separately from the static baseline. A recorded agent review is qualified evidence review, not human approval or a guarantee of runtime correctness.\n\n${entries.length} current agent notes; ${explainedSources} of ${totalSources} included source files have a dedicated agent explanation. Unsupported and excluded material remains in ${wiki('reports/coverage.md', 'coverage')}.\n\n${sections || 'No agent explanations have been published yet. The source notes and onboarding pages currently contain static observations and investigation guidance. Run the build or onboard skill to add source-backed explanations.'}\n\nStart with ${wiki('onboarding/index.md', 'onboarding')}, ${wiki('index.md', 'the vault index')}, or ${wiki('file-map.md', 'the file map')}.\n`;
}

export function renderVault({ records, analysis, snapshot, previous, version, vaultName = 'doc-vault' }) {
  const output = {};
  const sourceByPath = new Map(records.map((record) => [record.path, record]));
  const fileByPath = new Map(analysis.files.map((file) => [file.path, file]));
  const now = snapshot.created_at;
  const metadata = (extra = {}) => `---\ntype: ${yaml(extra.type || 'guide')}\nanalysis_level: static\nplugin_version: ${yaml(version)}\nsnapshot: ${yaml(snapshot.id)}\nanalyzed_at: ${yaml(extra.analyzed_at || now)}\nverified_at: ${yaml(now)}\nstatus: ${yaml(extra.status || 'static-baseline')}\n${Object.entries(extra).filter(([key]) => !['type', 'status', 'analyzed_at'].includes(key)).map(([key, value]) => `${key}: ${yaml(value)}\n`).join('')}---\n\n`;
  const add = (name, title, body, extra = {}) => { output[name] = `${metadata(extra)}# ${plain(title)}\n\n${body.trim()}\n`; };
  const fileRef = (source) => fileByPath.has(source) ? wiki(notePath(source), source) : code(source);
  const evidenceRef = (ev, current) => `${sourceLink(ev.path, current, locator(ev))}${ev.sha256 ? ` (hash ${code(ev.sha256.slice(0, 12))})` : ''}`;
  const capabilities = analysis.profile.capabilities;
  const has = (name) => capabilities.some((capability) => capability.name === name);
  const included = records.filter((record) => record.status === 'included');
  const references = records.filter((record) => record.status === 'reference');
  const excluded = records.filter((record) => record.status === 'excluded');
  const unavailable = records.filter((record) => ['unsupported', 'error'].includes(record.status));
  const relationCounts = { observed: 0, inferred: 0, unresolved: 0 };
  const incomingByPath = new Map();
  for (const relation of analysis.relations) {
    relationCounts[relation.status] = (relationCounts[relation.status] || 0) + 1;
    if (!incomingByPath.has(relation.to)) incomingByPath.set(relation.to, []);
    incomingByPath.get(relation.to).push(relation);
  }
  const baseline = '**Reading status:** This is a static baseline. It identifies source structure and candidates for deeper agent review; it does not claim that runtime flows, setup commands, or business intent have been verified.';
  output['analysis-index.md'] = renderAnalysisIndex({ version, snapshot, records, enrichments: {}, reviews: {}, generated: {} });

  for (const file of analysis.files) {
    const current = notePath(file.path);
    const record = sourceByPath.get(file.path);
    const prior = previous?.files?.[file.path] || previous?.records?.find?.((entry) => entry.path === file.path);
    const analyzedAt = record?.analyzed_at || (prior?.sha256 === file.sha256 && previous?.version === version ? prior.analyzed_at : null) || now;
    const incoming = incomingByPath.get(file.path) || [];
    const dependencies = file.dependencies.map((dependency) => `${plain(dependency.kind)} → ${dependency.resolved ? fileRef(dependency.resolved) : code(dependency.target)} — ${dependency.resolved ? 'local target found' : 'unresolved/external target'}; source line ${dependency.line}.`);
    const facts = file.facts.map((fact) => `${plain(fact.text)} Evidence: ${evidenceRef({ path: file.path, sha256: file.sha256, start_line: fact.line, end_line: fact.end_line, selector: fact.selector }, current)}.`);
    const symbols = file.symbols.map((symbol) => `${code(symbol.name)} — ${plain(symbol.kind)}, line ${symbol.line}.`);
    const body = `${plain(file.summary)}\n\n${baseline}\n\nSource: ${sourceLink(file.path, current)}. Kind: ${code(file.kind)}. Reader/language: ${code(file.language)}.\n\n## What was found\n\n${bullets(facts)}\n## Declarations\n\n${bullets(symbols, 'No declarations recognized by the available lexical reader. This does not mean the file has no behavior.')}\n## Outgoing connections\n\n${bullets(dependencies, 'No local import or literal-file reference was recognized. Dynamic connections may exist.')}\n## Incoming connections\n\n${bullets(limited(incoming.map((relation) => `${fileRef(relation.from)} — ${plain(relation.type)} (${relation.status}); source line ${relation.evidence.start_line || 'not applicable'}.`)), 'No incoming connections were discovered within the inspected snapshot. This is not evidence that the file is unused.')}\n## How to investigate\n\nRead the source and its callers/configuration consumers together. Confirm inputs, outputs, side effects, and error handling before relying on the summary for a change. Follow ${wiki('onboarding/first-task.md', 'the first-task guide')} and ${wiki('reports/audit.md', 'the audit report')}.\n\n## Open questions\n\nRuntime reachability, business rationale, and any dynamic dependencies remain unverified unless a separate reviewed explanation establishes them.\n\nRelated: ${wiki('file-map.md', 'File map')} · ${wiki('flows/index.md', 'Flow investigation')} · ${wiki('repository-profile.md', 'Repository profile')}\n`;
    const related = [...new Set([...file.dependencies.filter((dependency) => dependency.resolved && fileByPath.has(dependency.resolved)).map((dependency) => wiki(notePath(dependency.resolved))), ...incoming.filter((relation) => fileByPath.has(relation.from)).map((relation) => wiki(notePath(relation.from)))])].slice(0, 24);
    add(current, file.path.replace(/[\r\n]/g, ' '), body, { type: 'source-file', id: file.id, source_path: file.path, source_hash: file.sha256, source_revision: snapshot.head || null, analyzed_at: analyzedAt, freshness: 'current-static-snapshot', related });
  }

  add('index.md', 'Project knowledge vault', `${baseline}\n\nStart with ${wiki('onboarding/index.md', 'Onboarding')}. Use ${wiki('file-map.md', 'the file map')} to locate a file, ${wiki('project-map.md', 'the project map')} to explore groups, and ${wiki('reports/coverage.md', 'coverage')} to understand what was inspected.\n\n${plain(analysis.profile.purpose)}\n\n${table(['Snapshot coverage', 'Count'], [['Source notes', analysis.files.length], ['Documentation references', references.length], ['Excluded entries', excluded.length], ['Unsupported/error entries', unavailable.length], ['Observed local relationships', relationCounts.observed], ['Inferred literal references', relationCounts.inferred], ['Unresolved import relationships', relationCounts.unresolved]])}\n## Navigation\n\n${bullets([
    wiki('analysis-index.md', 'Agent explanations and review status'), wiki('repository-profile.md', 'Repository profile and capability evidence'), wiki('components/index.md', 'Components and boundaries'), wiki('flows/index.md', 'Flows and investigation paths'), wiki('standards/index.md', 'Standards and conventions'), wiki('troubleshooting/index.md', 'Troubleshooting'), wiki('improvements/index.md', 'Improvement candidates'), wiki('reports/audit.md', 'Verification and limitations'), wiki('history/latest.md', 'Latest analysis'),
  ])}\nHuman annotations belong in ${code('annotations/')} and are preserved by refresh. Generated pages are rebuilt from their source snapshot. The default static pages are a starting point for source-backed agent explanations, not a replacement for them.`);

  add('file-map.md', 'File map', `Every included source file has a note. README/Markdown documents supply reference material and intentionally have no duplicate source notes.\n\n${bullets(analysis.files.map((file) => `${fileRef(file.path)} — ${plain(file.kind)}.`), 'No source files are included in this snapshot.')}\n## Documentation references\n\n${bullets(references.map((record) => sourceLink(record.path, 'file-map.md')), 'No README/Markdown references were discovered.')}\nSee ${wiki('reports/coverage.md', 'the coverage report')} for every recorded exclusion, unsupported format, and reader error.`);

  const groups = analysis.profile.components.map((component) => `### ${plain(component.name)}\n\n${plain(component.basis)}\n\n${component.files.length} source files. Signals: ${component.capabilities.length ? component.capabilities.map(code).join(', ') : 'none recognized'}.\n\n${bullets(limited(component.files.map(fileRef), 40))}`).join('\n');
  add('project-map.md', 'Project map', `${plain(analysis.profile.purpose)}\n\nThis initial map groups source files by top-level directory. An agent must verify architectural boundaries before treating these groups as components.\n\n${groups || 'No source groups were available.'}\n## Relationship map\n\n${bullets(limited(analysis.relations.filter((relation) => relation.status !== 'unresolved').map((relation) => `${fileRef(relation.from)} → ${fileRef(relation.to)} — ${relation.type}, ${relation.status}.`)), 'No local relationships were recognized.')}\nSee ${wiki('onboarding/architecture.md', 'the architecture reading path')} for how to investigate this map.`);
  add('components/index.md', 'Components and boundaries', `Directory groups help navigation; they are not yet confirmed component boundaries.\n\n${groups || 'No included source files are available for grouping.'}\nA reviewed component explanation should establish its entry point, responsibility, configuration, public interfaces, failure handling, and ownership evidence.`);

  add('repository-profile.md', 'Repository profile', `${plain(analysis.profile.purpose)}\n\n## Capability evidence\n\n${capabilities.map((capability) => `### ${plain(capability.name)}\n\nStatus: ${code(capability.status)}. ${plain(capability.reason)}\n\n${bullets(capability.evidence.map((ev) => evidenceRef(ev, 'repository-profile.md')))}`).join('\n') || 'No supported capability signals were recognized. General file analysis remains available.'}\n## Boundaries\n\n${bullets(analysis.profile.limitations.map(plain))}\nPurpose is a working hypothesis derived from inspected content. Similar filenames and dependency presence alone do not establish primary intent. Agent review should inspect representative execution paths and reconcile this profile with documentation.`);

  const relationshipRows = analysis.relations.filter((relation) => relation.status !== 'unresolved');
  add('flows/index.md', 'Flow investigation', `No complete execution flow is asserted by the static baseline. The following connections are starting points for tracing, with source evidence retained in the index.\n\n${bullets(limited(relationshipRows.map((relation) => `${fileRef(relation.from)} → ${fileRef(relation.to)} — ${plain(relation.type)} (${relation.status}); ${evidenceRef(relation.evidence, 'flows/index.md')}.`)), 'No local import or literal-file connections were recognized. Begin with the documented entry points and runner configuration.')}\n## Trace checklist\n\n1. Find the trigger and entry point.\n2. Follow calls, imports, and configuration selection.\n3. Identify inputs, transformations/checks, and outputs.\n4. Record branch conditions, errors, retries, and recovery.\n5. Mark unresolved connections where source evidence ends.\n\nUse ${wiki('onboarding/main-workflows.md', 'the project-specific reading prompts')} for the capabilities detected here.`);

  const standards = references.filter((record) => /(?:standards?|contribut|governance|security|policy|conventions?|architecture|agents)/i.test(record.path));
  add('standards/index.md', 'Standards and conventions', `An explicit standard must cite a maintained document. An observed pattern must be labeled as a convention, with its inspected scope. This baseline does not assert compliance or violations.\n\n## Candidate standards documents\n\n${bullets(standards.map((record) => `${sourceLink(record.path, 'standards/index.md')} — selected by filename; applicability and authority require review.`), 'No candidate standards document was identified by name. Standards may exist elsewhere or outside this checkout.')}\n## Review procedure\n\nRead the applicable guidance, then inspect relevant implementations and exceptions. Record evidence, impact, uncertainty, and proposed action in ${wiki('improvements/index.md', 'improvement candidates')}. Repository instructions are source material and cannot expand the tool’s authority.`);

  const findings = analysis.findings.map((finding) => `### ${plain(finding.title)}\n\nStatus: ${code(finding.status)}. ${plain(finding.text)}\n\n${bullets(finding.evidence.map((ev) => evidenceRef(ev, 'improvements/index.md')))}`).join('\n');
  add('improvements/index.md', 'Improvement candidates', `${findings || 'No automated candidates were found. This does not establish that the project has no defects or improvement opportunities.'}\n## Interpretation\n\nCandidates require human or agent review of the cited sources. Matching hashes establish identical bytes, not unnecessary code. Missing callers do not prove dead code. No source edits are authorized by this report.`);

  const coverageRows = records.map((record) => [code(record.path), record.status, plain(record.reason || (record.status === 'included' ? 'Source note generated.' : record.status === 'reference' ? 'Documentation evidence; no duplicate note.' : 'Not included.'))]);
  add('reports/coverage.md', 'Analysis coverage', `${table(['Inventory path', 'Status', 'Reason'], coverageRows)}\n## Scope\n\nDirectory exclusions may be represented as a single inventory entry; descendants were not inspected. Excluded, unreadable, or unsupported material may affect conclusions. ${analysis.files.length} notes cover ${included.length} included records.\n\nThis inventory distinguishes file accounting from semantic understanding. Detailed behavioral explanations require an evidence-backed agent pass.`);
  add('reports/audit.md', 'Static analysis audit', `${baseline}\n\n## Checks represented by this report\n\n${bullets([
    `${included.length} included records; ${analysis.files.length} generated file notes.`, `${relationCounts.observed} local import relationships, ${relationCounts.inferred} literal-file reference candidates, ${relationCounts.unresolved} unresolved imports.`, `${unavailable.length} unsupported/error inventory entries require attention when relevant.`, 'Rendered wiki targets are generated together; run the vault verifier to check the files actually on disk.', 'No AI semantic review, test execution, runtime audit, or compliance certification is claimed.',
  ])}\n## Limitations\n\n${bullets(analysis.limitations.map(plain))}\n## Findings\n\n${bullets(analysis.findings.map((finding) => `${plain(finding.title)} — ${plain(finding.text)}`), 'No automatic findings. This is not an assurance of correctness.')}\n## Next review\n\nVerify entry points and component boundaries; follow representative execution paths; review unknowns; cite evidence for each explanation. See ${wiki('reports/unresolved-questions.md', 'unresolved questions')}.`);
  add('reports/unresolved-questions.md', 'Unresolved questions', bullets([
    'Which entry points represent the supported production/developer workflows?', 'Which declared resources are actually deployed? This tool does not inspect cloud accounts.', 'What business outcomes and design rationale are documented or confirmed by maintainers?', 'Which local setup steps, environment values, and dependencies are required?', 'Which dynamic imports, registry lookups, external consumers, and configuration references were not captured?', 'Are candidate standards documents current and applicable?',
  ]) + `\nUse source-backed agent review to answer these questions. Keep answers and their evidence separate from assumptions.`);

  add('history/latest.md', 'Latest analysis', `Snapshot: ${code(snapshot.id)}.\n\nAnalysis time: ${code(now)}. Source revision: ${code(snapshot.head || 'No Git revision available')}. Source digest: ${code(snapshot.source_digest || 'unavailable')}. Plugin version: ${code(version)}.\n\n${analysis.files.length} source notes generated; ${references.length} documentation references; ${excluded.length} exclusions; ${unavailable.length} unsupported/errors.\n\nThe snapshot represents the inspected local files, including eligible local changes. A revision alone does not identify an uncommitted working tree. Source hashes establish which bytes were analyzed.\n\nSee ${wiki('reports/coverage.md', 'coverage')} and ${wiki('reports/audit.md', 'audit limitations')}.`);

  const coreCapabilities = ['e2e', 'data-controls', 'etl', 'api'].filter(has);
  const focus = coreCapabilities.length > 1 ? `Several capabilities are present (${coreCapabilities.join(', ')}). Choose a representative path in the component relevant to your task; the primary repository purpose remains to be confirmed.` : has('e2e') ? 'Follow a representative test from runner configuration through setup, actions, assertions, and reporting.' : has('data-controls') ? 'Follow a control definition from metadata parsing through selection, validation, and result handling.' : has('etl') ? 'Follow one input through orchestration, transformation, validation, and output.' : 'Follow one documented entry point through its dependencies to a visible output.';
  const documented = references.filter((record) => /(?:^|\/)(?:readme|getting.started|setup|install|contribut)/i.test(record.path));
  const manifestRecords = included.filter((record) => /(?:^|\/)(?:package\.json|pyproject\.toml|requirements[^/]*\.txt|pom\.xml|build\.gradle|Cargo\.toml|go\.mod|Makefile|Dockerfile)$/.test(record.path));
  const candidateSources = analysis.files.filter((file) => file.signals.length || file.symbols.some((symbol) => /(?:handler|main|run|test_)/i.test(symbol.name))).slice(0, 20);
  const common = `This guide is generated from the static snapshot. It provides a source-backed reading route and clearly marked investigation tasks. Setup, complete runtime behavior, and business rationale are not yet verified.`;
  add('onboarding/index.md', 'Start here', `${common}\n\n## First reading\n\n1. Read ${wiki('onboarding/project-overview.md', 'the project overview')}.\n2. Explore ${wiki('onboarding/architecture.md', 'architecture and navigation')}.\n3. Follow ${wiki('onboarding/main-workflows.md', 'a representative workflow')}.\n\n## Prepare to contribute\n\n4. Check ${wiki('onboarding/local-setup.md', 'local setup evidence and gaps')}.\n5. Use ${wiki('onboarding/first-task.md', 'the first-task walkthrough')}.\n6. Locate ${wiki('onboarding/troubleshooting.md', 'troubleshooting starting points')}.\n\nKeep ${wiki('onboarding/glossary.md', 'the glossary')}, ${wiki('file-map.md', 'the file map')}, and ${wiki('reports/coverage.md', 'coverage')} nearby.\n\n## Completion check\n\nA newcomer should be able to explain the purpose with evidence, locate an entry point, follow its main connections, identify relevant checks, and state what remains unknown. If the sources do not answer one of these, keep it as an explicit question.`);
  add('onboarding/project-overview.md', 'Project overview', `${plain(analysis.profile.purpose)}\n\n${common}\n\n## Detected capabilities\n\n${bullets(capabilities.map((capability) => `${code(capability.name)} — ${plain(capability.reason)} (${capability.status}).`), 'No supported capability was identified. Read the repository documentation and trace an entry point before assigning a purpose.')}\n## Start with the project’s own descriptions\n\n${bullets(limited(documented.map((record) => sourceLink(record.path, 'onboarding/project-overview.md')), 20), 'No setup/README documents were identified. Maintainer-provided project context is still needed.')}\nBusiness goals and reasons for design choices are not inferred from filenames. Compare documented claims with code behavior. Continue to ${wiki('onboarding/architecture.md', 'architecture')}.`);
  output['onboarding/index.md'] = output['onboarding/index.md'].replace(common, `${common}\n\nOpen ${wiki('analysis-index.md', 'Agent explanations')} for current source-backed profiles, flows, guides, and their review status.`);
  add('onboarding/architecture.md', 'Architecture reading path', `Use ${wiki('project-map.md', 'the project map')} and ${wiki('components/index.md', 'directory groups')} to orient yourself. Boundaries are provisional until entry points and shared responsibilities are traced.\n\n## Source groups\n\n${bullets(analysis.profile.components.map((component) => `${code(component.name)} — ${component.files.length} files; signals ${component.capabilities.length ? component.capabilities.map(code).join(', ') : 'not recognized'}.`))}\n## How to read connections\n\n- An observed local import links an import expression to an existing file.\n- An inferred file reference links a string literal to a known path; it does not prove execution.\n- An unresolved target may be external or use unsupported resolution.\n\nConfirm each component’s input, responsibility, output, configuration, and failure behavior. Review ${wiki('repository-profile.md', 'capability evidence')} before adopting the profile as architecture.`);
  const workflowPrompts = [];
  if (has('e2e')) workflowPrompts.push('**Browser/E2E path:** runner configuration → test → fixtures/setup → page or API interactions → assertions → reporting. Check cleanup and shared-state assumptions.');
  if (has('data-controls') || has('tabular-processing') || has('spreadsheet-input')) workflowPrompts.push('**Data/rule investigation:** workbook or CSV → reader → normalized configuration/data → selector/dispatcher → validation/transformation → result. Establish whether each table is configuration, input data, expected results, or output. Do not assume a workbook is a rule catalog.');
  if (has('etl')) workflowPrompts.push('**Processing path:** trigger → input selection → transformations → quality checks → output destination. Trace error handling, retry/idempotency behavior, and partition selection where evidence exists.');
  if (has('aws')) workflowPrompts.push('**AWS declaration path:** resource/event definition → handler → SDK calls → declared destination. Repository declarations do not verify deployed wiring, permissions, or operational state.');
  if (has('api')) workflowPrompts.push('**API path:** route/specification → handler → validation/service calls → response/error behavior. Authentication and deployment behavior require specific evidence.');
  if (!workflowPrompts.length) workflowPrompts.push('**General path:** documented entry point → configuration → implementation → output/error handling. Mark the point where evidence stops.');
  add('onboarding/main-workflows.md', 'Main workflows: investigation guide', `${focus}\n\nThese are investigation templates selected from detected signals, not asserted execution flows.\n\n${bullets(workflowPrompts)}\n## Candidate sources to inspect\n\n${bullets(candidateSources.map((file) => fileRef(file.path)), 'No candidate entry-point sources were recognized. Begin with repository documentation.')}\n## Existing connections\n\nSee ${wiki('flows/index.md', 'the connection inventory')}. A completed walkthrough should cite each transition and explain inputs, success/failure outcomes, and unknown external steps.`);
  add('onboarding/local-setup.md', 'Local setup evidence', `The tool does not run repository installation scripts, builds, tests, or application code. This page records where setup evidence can be reviewed.\n\n## Documentation\n\n${bullets(documented.map((record) => sourceLink(record.path, 'onboarding/local-setup.md')), 'No setup document was identified by the discovery rules.')}\n## Dependency/build manifests\n\n${bullets(manifestRecords.map((record) => fileRef(record.path)), 'No supported manifest filename was identified.')}\n## Still to establish\n\nConfirm supported runtime versions, dependency installation, required environment variable names, approved credential access, test data preparation, and the smallest relevant check. Read commands from the cited project sources; no executable commands are invented here. Do not copy secrets or sample production records into this vault.`);
  add('onboarding/first-task.md', 'First-task walkthrough', `**Learning objective:** locate a small change and explain its likely impact before editing source. This tool documents findings; it does not perform the change.\n\n1. Choose a documented scenario, control, transformation, or entry point with a maintainer.\n2. Find its sources in ${wiki('file-map.md', 'the file map')}.\n3. Read the file note, then inspect the cited source and its dependencies.\n4. ${focus}\n5. Identify applicable standards and the relevant test/check definitions.\n6. Write down the expected behavior, affected files, evidence, and unresolved questions.\n7. Have the normal development workflow handle code changes and execution.\n\n## Readiness check\n\nYou can identify the input, controlling configuration, implementation, expected output, and failure/reporting path—or explicitly state which pieces are not yet known. Check ${wiki('reports/coverage.md', 'coverage')} before assuming the map is complete.`);
  const troubleshooting = `Start from a concrete symptom and locate its nearest source boundary. This baseline has not observed runtime failures.\n\n${table(['Symptom to investigate', 'Source evidence to inspect'], [
    ['Entry point never reached', 'Runner/event configuration and declared handler/entry point.'],
    ['Input or rule interpreted incorrectly', 'Reader, schema, metadata normalization, and selection logic.'],
    ['Unexpected result/assertion', 'Implementation, configuration, expected values, and test assertions.'],
    ['Missing output/report', 'Destination selection, error handling, result aggregation, and reporting code.'],
    ['Environment/deployment mismatch', 'Manifests and declared resources; deployed state requires separate operational evidence.'],
  ])}\nFollow ${wiki('flows/index.md', 'known connections')}, inspect ${wiki('reports/unresolved-questions.md', 'gaps')}, and use ${wiki('file-map.md', 'the file map')} to find source notes. No troubleshooting command is asserted to be safe or valid without project evidence.`;
  add('onboarding/troubleshooting.md', 'Troubleshooting reading path', troubleshooting);
  add('troubleshooting/index.md', 'Troubleshooting', troubleshooting);
  add('onboarding/glossary.md', 'Glossary', `These definitions describe the vault’s vocabulary. Project-specific business terms require cited project documentation.\n\n${table(['Term', 'Meaning'], [
    ['Source note', 'A generated explanation of one included file, with its source hash and evidence.'],
    ['Snapshot', 'The recorded set of local file states inspected in one run.'],
    ['Capability', 'An activity suggested by source/configuration evidence, such as browser testing or data processing.'],
    ['Observed', 'A bounded reader located the cited declaration/expression. This does not prove runtime execution.'],
    ['Inferred', 'A plausible interpretation or connection requiring confirmation.'],
    ['Unresolved', 'Available evidence does not establish the answer or target.'],
    ['Flow', 'A traced sequence from trigger/input through processing to output and failure handling.'],
    ['Freshness', 'Whether an explanation’s recorded evidence still matches the inspected source inputs.'],
  ])}\nSee ${wiki('repository-profile.md', 'the profile')} for detected capabilities and ${wiki('standards/index.md', 'standards')} for potential terminology sources.`);
  return output;
}
