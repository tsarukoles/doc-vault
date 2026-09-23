import path from 'node:path';
import { inspectWorkbook, inspectDelimited } from './readers.mjs';

const p = path.posix;
const MAX_FACTS = 32;
const MAX_SYMBOLS = 80;
const MAX_DEPENDENCIES = 100;

function evidence(record, line = 1, end = line) {
  return { path: record.path, start_line: line, end_line: end, sha256: record.sha256 };
}

function lineAt(text, offset) { return text.slice(0, offset).split('\n').length; }

function symbolScan(record) {
  const text = record.text || '';
  const patterns = [
    { expression: /^[ \t]*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/gm, kind: 'function' },
    { expression: /^[ \t]*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([\w$]+)\s*\(/gm, kind: 'function' },
    { expression: /^[ \t]*(?:export\s+)?(?:abstract\s+)?class\s+([\w$]+)/gm, kind: 'class' },
    { expression: /^[ \t]*(?:export\s+)?(?:const|let)\s+([\w$]+)\s*=\s*(?:async\s*)?(?:\([^\n]*?\)|[\w$]+)\s*=>/gm, kind: 'function' },
    { expression: /^[ \t]*(?:export\s+)?(?:interface|type)\s+([\w$]+)/gm, kind: 'type' },
    { expression: /^[ \t]*resource\s+"([^"]+)"\s+"([^"]+)"/gm, kind: 'resource' },
  ];
  const symbols = [];
  for (const { expression, kind } of patterns) {
    for (const match of text.matchAll(expression)) {
      symbols.push({ name: kind === 'resource' ? `${match[1]}.${match[2]}` : match[1], kind, line: lineAt(text, match.index) });
      if (symbols.length >= MAX_SYMBOLS) return symbols.sort((a, b) => a.line - b.line);
    }
  }
  return symbols.sort((a, b) => a.line - b.line);
}

function signalsFor(record) {
  const text = record.text || '';
  const result = [];
  const add = (capability, expression, reason) => {
    const match = expression.exec(text);
    if (match) result.push({ capability, evidence: evidence(record, lineAt(text, match.index)), reason });
  };
  // Documentation alone cannot establish runtime capabilities.
  if (record.status === 'reference') return result;
  add('e2e', /(?:@playwright\/test|from\s+playwright|import\s+playwright|["']cypress["']|from\s+selenium|webdriverio)/i, 'Browser automation dependency or import appears in source/configuration.');
  add('tests', /(?:\b(?:test|it|describe)\s*\(|\bdef\s+test_\w+|\bpytest\b|\bunittest\b|["']jest["'])/, 'Test declarations, framework imports, or test dependencies appear in content.');
  add('aws', /(?:\bboto3\b|@aws-sdk\/|\bAWS::[A-Za-z]+::|\baws_(?:lambda|s3|glue|iam|sfn)_|\baws_lambda_function\b|\baws-cdk-lib\b)/, 'AWS SDK, declared resource, or infrastructure provider evidence.');
  add('infrastructure', /(?:\bresource\s+"[\w-]+"\s+"|\bterraform\s*\{|\bAWS::[A-Za-z]+::|\baws-cdk-lib\b|\bkind:\s*(?:Deployment|Service|StatefulSet|ConfigMap)\b)/, 'Infrastructure resource or deployment declaration appears in content.');
  add('etl', /(?:\b(?:from|import)\s+pyspark\b|\b(?:from|import)\s+airflow\b|\bglueContext\b|\bGlueContext\b|\bSparkSession\b)/, 'Data processing or orchestration framework import/use.');
  add('tabular-processing', /(?:\bread_csv\s*\(|\bread_excel\s*\(|\bcsv\.(?:reader|DictReader)|\bopenpyxl\b|\bload_workbook\s*\()/, 'Tabular-file reader call/import appears in source.');
  add('api', /(?:\bFastAPI\s*\(|\bFlask\s*\(|\bexpress\s*\(|\bopenapi\s*:\s*["']?3\.|\bswagger\s*:\s*["']?2\.)/, 'API framework construction or API specification appears in content.');
  add('data-controls', /(?:\bgreat_expectations\b|\bpandera\b|\bpydeequ\b|\bsoda\.scan\b)/, 'Data-validation framework import/dependency appears in content.');
  if (/\b(?:control|validation|check)[_ -]?(?:registry|rules?|types?|config)\b/i.test(text) && /\b(?:metadata|schema|threshold|dataset)\b/i.test(text)) {
    add('data-controls', /\b(?:control|validation|check)[_ -]?(?:registry|rules?|types?|config)\b/i, 'Control/rule terminology and dataset/schema/metadata terminology coexist; needs flow confirmation.');
  }
  if (/(?:^|\/)\.github\/workflows\//.test(record.path) && /\bjobs\s*:/.test(text)) add('ci', /\bjobs\s*:/, 'Workflow path and job declaration agree.');
  if (/(?:^|\/)(?:\.gitlab-ci\.ya?ml|Jenkinsfile|azure-pipelines\.ya?ml)$/.test(record.path)) add('ci', /(?:\bstages?\s*:|\bpipeline\s*\{|\bjobs\s*:)/, 'Pipeline filename and execution declaration agree.');
  if (/\.xlsx$/i.test(record.path)) result.push({ capability: 'spreadsheet-input', evidence: { path: record.path, sha256: record.sha256, selector: { kind: 'workbook' } }, reason: 'A workbook is present; its runtime role is not yet established.' });
  return result;
}

function importScan(record) {
  const text = record.text || '';
  const ext = p.extname(record.path).toLowerCase();
  const result = [];
  if (['.py', '.pyi'].includes(ext)) {
    for (const [index, raw] of text.split(/\r?\n/).entries()) {
      const from = /^\s*from\s+([.\w]+)\s+import\s+(.+)/.exec(raw);
      if (from) {
        result.push({ target: from[1], kind: 'imports', line: index + 1, imported: from[2].split(',').map((name) => name.trim().split(/\s+as\s+/)[0]) });
      } else {
        const direct = /^\s*import\s+([^#]+)/.exec(raw);
        if (direct) for (const item of direct[1].split(',')) {
          const target = item.trim().split(/\s+as\s+/)[0];
          if (/^[\w.]+$/.test(target)) result.push({ target, kind: 'imports', line: index + 1 });
        }
      }
    }
  } else if (/\.[cm]?[jt]sx?$/.test(ext)) {
    const re = /(?:\b(?:import|export)\s+(?:[^;'"\n]*?\s+from\s*)?|\brequire\s*\(\s*|\bimport\s*\(\s*)["']([^"'\n]+)["']/g;
    for (const match of text.matchAll(re)) {
      result.push({ target: match[1], kind: 'imports', line: lineAt(text, match.index) });
      if (result.length >= MAX_DEPENDENCIES) break;
    }
  }
  return result.slice(0, MAX_DEPENDENCIES);
}

function resolveImport(record, dependency, paths) {
  const ext = p.extname(record.path).toLowerCase();
  const candidates = [];
  if (['.py', '.pyi'].includes(ext)) {
    const leading = /^\.+/.exec(dependency.target)?.[0].length || 0;
    const module = dependency.target.slice(leading).replaceAll('.', '/');
    let bases;
    if (leading) {
      let base = p.dirname(record.path);
      for (let i = 1; i < leading; i++) base = p.dirname(base);
      bases = [p.join(base, module)];
    } else bases = [module, p.join('src', module)];
    for (const base of bases) {
      candidates.push(`${base}.py`, `${base}/__init__.py`);
      if (dependency.imported) for (const member of dependency.imported) {
        if (/^\w+$/.test(member)) candidates.push(`${base}/${member}.py`, `${base}/${member}/__init__.py`);
      }
    }
  } else if (dependency.target.startsWith('.')) {
    const base = p.normalize(p.join(p.dirname(record.path), dependency.target));
    candidates.push(base, ...['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json'].map((suffix) => base + suffix));
    if (/\.[cm]?js$/.test(base)) candidates.push(base.replace(/\.[cm]?js$/, '.ts'), base.replace(/\.js$/, '.tsx'));
    candidates.push(...['index.js', 'index.ts', 'index.tsx', 'index.mjs'].map((name) => `${base}/${name}`));
  }
  return [...new Set(candidates)].find((candidate) => !candidate.startsWith('../') && paths.has(candidate));
}

function fileFacts(record, symbols) {
  const facts = [];
  const text = record.text || '';
  const ext = p.extname(record.path).toLowerCase();
  if (ext === '.xlsx') {
    const workbook = inspectWorkbook(record.bytes);
    for (const sheet of workbook.sheets.slice(0, 24)) facts.push({
      text: sheet.available ? `Worksheet ${sheet.name}: ${sheet.cellCount} stored cells, ${sheet.formulaCount} formula cells. Values and formulas are not reproduced.` : `Worksheet ${sheet.name}: contents unavailable to the bounded reader.`,
      selector: { sheet: sheet.name, ...(sheet.firstCell ? { cell: sheet.firstCell } : {}) },
    });
    for (const limitation of workbook.limitations) facts.push({ text: limitation, selector: { kind: 'workbook' } });
  } else if (['.csv', '.tsv'].includes(ext)) {
    const table = inspectDelimited(text, ext);
    facts.push({ text: `Delimited text: ${table.recordCount} non-empty records including any header; ${table.minColumns}–${table.maxColumns} columns; delimiter ${JSON.stringify(table.delimiter)}.`, line: 1 });
    if (table.headers.length) facts.push({ text: `Possible column headers: ${table.headers.join(', ')}. Header interpretation is heuristic.`, line: 1 });
    facts.push({ text: 'Data/configuration/output role is unresolved until linked to a consumer; data rows are not reproduced.', line: 1 });
    if (table.malformed) facts.push({ text: 'The reader found an unterminated quoted field; parsing may be incomplete.', line: 1 });
  } else {
    if (symbols.length) facts.push({ text: `Recognized ${symbols.length}${symbols.length === MAX_SYMBOLS ? '+' : ''} declarations using bounded lexical patterns; this is not a complete syntax or call analysis.`, line: symbols[0].line });
    if (p.basename(record.path) === 'package.json') {
      try {
        const pkg = JSON.parse(text);
        const dependencies = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies }).slice(0, 40);
        if (dependencies.length) facts.push({ text: `Declared packages: ${dependencies.join(', ')}.`, line: 1 });
        const scripts = Object.keys(pkg.scripts || {}).slice(0, 24);
        if (scripts.length) facts.push({ text: `Declared task names: ${scripts.join(', ')}. Commands were not executed.`, line: 1 });
      } catch { facts.push({ text: 'Manifest could not be parsed as JSON.', line: 1 }); }
    }
    const handler = /\b(?:def\s+lambda_handler|exports\.handler\s*=|export\s+(?:const|async\s+function)\s+handler)\b/.exec(text);
    if (handler) facts.push({ text: 'A handler-shaped declaration is present; deployment wiring and actual invocation remain to be traced.', line: lineAt(text, handler.index) });
    const controls = /\b(?:control|validation|check)[_ -]?(?:registry|rules?|types?|config)\b/i.exec(text);
    if (controls) facts.push({ text: 'Rule/control naming appears in this file; metadata-to-execution mapping requires deeper review.', line: lineAt(text, controls.index) });
  }
  if (!facts.length) facts.push({ text: text ? `${text.split(/\r?\n/).length} source lines inspected; no supported structural declaration was recognized.` : 'File recorded in the inventory; no text structure was available to this reader.', ...(ext === '.xlsx' ? { selector: { kind: 'workbook' } } : { line: 1 }) });
  return facts.slice(0, MAX_FACTS);
}

function describe(record, symbols, signals) {
  const role = { source: 'Source implementation', config: 'Configuration', test: 'Test source', infra: 'Infrastructure definition', ci: 'Automation/pipeline definition', rules: 'Rule-related file', data: 'Data-format file', spreadsheet: 'Spreadsheet workbook', document: 'Documentation', unknown: 'Repository file' }[record.kind] || 'Repository file';
  const declared = symbols.filter((s) => ['function', 'class'].includes(s.kind)).slice(0, 4).map((s) => s.name);
  const capabilities = [...new Set(signals.map((s) => s.capability))];
  return `${role}${declared.length ? ` with declarations ${declared.join(', ')}` : ''}.${capabilities.length ? ` Content signals: ${capabilities.join(', ')}.` : ''} Behavioral purpose requires evidence review.`;
}

export function analyzeRepository(records) {
  const visible = records.filter((record) => ['included', 'reference'].includes(record.status));
  const paths = new Set(visible.map((record) => record.path));
  const files = [], relations = [], findings = [];
  const limitations = [
    'This baseline uses bounded lexical extraction, not a complete parser or runtime trace. Comments, strings, aliases, dynamic imports, reflection, and framework conventions may be misinterpreted or missed.',
    'Declared resources and configuration do not establish what is deployed or running. No source code, tests, builds, or data transformations were executed.',
    'External references and consumers outside this checkout are not inspected. No complete call graph or data lineage is claimed.',
  ];
  for (const record of visible) {
    if (record.status === 'reference') continue;
    const symbols = symbolScan(record);
    const signals = signalsFor(record);
    const dependencies = importScan(record);
    for (const dependency of dependencies) {
      dependency.resolved = resolveImport(record, dependency, paths) || null;
      relations.push({ from: record.path, to: dependency.resolved || dependency.target, type: 'imports', evidence: evidence(record, dependency.line), status: dependency.resolved ? 'observed' : 'unresolved' });
    }
    // Only literal references to known files are connected. No guessed execution edges.
    if (record.text && record.status !== 'reference') {
      for (const match of record.text.matchAll(/["']([^"'\r\n]{1,240})["']/g)) {
        if (dependencies.length >= MAX_DEPENDENCIES) break;
        const literal = match[1].replaceAll('\\', '/');
        if (!/\.[A-Za-z0-9]{1,10}$/.test(literal) || literal.includes('://')) continue;
        const target = [literal, p.normalize(p.join(p.dirname(record.path), literal))].find((candidate) => paths.has(candidate));
        if (!target || target === record.path || dependencies.some((d) => d.resolved === target)) continue;
        const line = lineAt(record.text, match.index);
        dependencies.push({ target: literal, kind: 'references', line, resolved: target });
        relations.push({ from: record.path, to: target, type: 'references', evidence: evidence(record, line), status: 'inferred' });
      }
    }
    if (record.status === 'included') files.push({ id: record.id, path: record.path, sha256: record.sha256, kind: record.kind, language: record.language,
      summary: describe(record, symbols, signals), symbols, facts: fileFacts(record, symbols), dependencies, signals });
  }
  const grouped = new Map();
  for (const file of files) for (const signal of file.signals) {
    if (!grouped.has(signal.capability)) grouped.set(signal.capability, []);
    grouped.get(signal.capability).push(signal);
  }
  const capabilities = [...grouped].map(([name, signals]) => ({ name,
    status: ['data-controls', 'spreadsheet-input'].includes(name) ? 'inferred' : 'observed',
    evidence: signals.slice(0, 12).map((signal) => signal.evidence),
    reason: [...new Set(signals.map((signal) => signal.reason))].join(' '),
  }));
  const names = new Set(capabilities.map((c) => c.name));
  const outcomeCapabilities = ['e2e', 'data-controls', 'etl', 'api'].filter((name) => names.has(name));
  let purpose = 'Purpose unresolved: review entry points, configuration consumers, and existing documentation before asserting the project outcome.';
  if (outcomeCapabilities.length > 1) purpose = `Multiple capabilities are present (${outcomeCapabilities.join(', ')}). Their component roles and the repository's primary purpose are unresolved; supporting tests do not establish that testing is the primary product.`;
  else if (names.has('data-controls') && (names.has('tabular-processing') || names.has('spreadsheet-input'))) purpose = 'Working hypothesis: metadata or tabular-data validation. Trace configuration through rule selection and result handling to confirm the primary purpose.';
  else if (names.has('e2e')) purpose = 'Browser automation is present. Determine whether it is the main product or a supporting test component by tracing runner configuration and scenario entry points.';
  else if (names.has('etl')) purpose = 'Data processing/orchestration is present. Trace input selection, transformations, and outputs to establish the project outcome.';
  else if (names.has('api')) purpose = 'API implementation/specification is present. Trace routes and consumers to establish the service responsibility.';
  else if (names.has('infrastructure')) purpose = 'Infrastructure declarations are present. Their role in the wider project and deployed state remain unverified.';
  const componentMap = new Map();
  for (const file of files) {
    const name = file.path.includes('/') ? file.path.split('/')[0] : '(root)';
    if (!componentMap.has(name)) componentMap.set(name, { name, status: 'inferred', basis: 'Directory grouping, not an asserted architectural boundary.', files: [], capabilities: [] });
    const component = componentMap.get(name); component.files.push(file.path);
    component.capabilities.push(...file.signals.map((s) => s.capability));
  }
  const components = [...componentMap.values()].map((c) => ({ ...c, capabilities: [...new Set(c.capabilities)] }));
  const hashes = new Map();
  for (const record of records.filter((r) => r.status === 'included' && r.size > 80 && r.sha256)) {
    if (!hashes.has(record.sha256)) hashes.set(record.sha256, []);
    hashes.get(record.sha256).push(record);
  }
  for (const group of hashes.values()) if (group.length > 1 && findings.length < 20) findings.push({
    title: 'Identical-content files', status: 'candidate',
    text: `${group.map((r) => r.path).join(', ')} have matching content hashes. This may be intentional fixture/copy material; duplication is not evidence that removal is safe.`,
    evidence: group.slice(0, 10).map((r) => ({ path: r.path, sha256: r.sha256 })),
  });
  if (relations.some((r) => r.status === 'unresolved')) findings.push({ title: 'Unresolved import targets', status: 'unresolved', text: 'Some imports could not be linked to a file in this snapshot. They may be external packages, aliases, generated modules, or unsupported resolution patterns; this is not evidence of broken code.', evidence: relations.filter((r) => r.status === 'unresolved').slice(0, 10).map((r) => r.evidence) });
  return { files, relations, profile: { purpose, capabilities, components, limitations: [...limitations] }, findings, limitations };
}
