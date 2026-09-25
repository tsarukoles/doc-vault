#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMAND_TOOLS } from '../src/run-authorization.mjs';

// Inspect only this distribution's authored assets. Generated vaults, target
// repositories, fixtures, and links supplied by repository content are not inputs.
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSET_ROOTS = ['agents', 'skills', 'policies', 'workflows', 'packs', 'templates', 'schemas', 'docs'];
const CONTEXT_ROOTS = new Set(['policies', 'workflows', 'packs', 'templates', 'schemas', 'docs']);
const SKILLS = ['build', 'sync', 'audit', 'onboard', 'ask', 'status', 'review', 'standards'];
const PREFIX = 'mcp__plugin_edw-doc_vault__';
const READ_TOOLS = ['vault_status', 'vault_list', 'vault_read', 'vault_search', 'vault_context', 'vault_packet', 'vault_note', 'vault_standards'];
const AGENT_TOOLS = {
  curator: [...READ_TOOLS, 'vault_scan', 'vault_publish', 'vault_lint', 'vault_refresh', 'vault_begin', 'vault_end'],
  worker: READ_TOOLS,
  reviewer: [...READ_TOOLS, 'vault_review', 'vault_begin', 'vault_end'],
  standards: [...READ_TOOLS, 'vault_rule', 'vault_assess', 'vault_begin', 'vault_end'],
};
const REQUIRED = [
  'package.json', '.claude-plugin/plugin.json', '.mcp.json',
  'hooks/hooks.json', 'README.md', 'GET-STARTED.md', 'scripts/cli.mjs', 'scripts/mcp.mjs', 'scripts/session-start.mjs',
  'scripts/maintenance-hook.mjs', 'src/integration.mjs', 'src/maintenance.mjs', 'policies/documentation-style.md', 'docs/business-overview.md',
  'scripts/run-lifecycle.mjs', 'src/run-authorization.mjs', 'src/identity.mjs', 'docs/run-approval.md',
  'scripts/check-package.mjs', 'src/engine.mjs', 'src/security.mjs', 'src/inventory.mjs',
  'src/analyze.mjs', 'src/readers.mjs', 'src/render.mjs', 'policies/core.md',
  ...Object.keys(AGENT_TOOLS).map(name => `agents/${name}.md`),
  ...SKILLS.map(name => `skills/${name}/SKILL.md`),
  ...['build', 'sync', 'audit', 'onboard', 'ask', 'status', 'review', 'standards', 'discovery', 'file-analysis', 'flow']
    .map(name => `workflows/${name}.md`),
  ...['generic', 'e2e', 'data-controls', 'standards'].map(name => `packs/${name}.md`),
  ...['file', 'component', 'flow', 'standard', 'finding', 'onboarding', 'profile'].map(name => `templates/${name}.md`),
  'packs/standards/catalog.json',
  ...['evidence', 'note-input', 'review-input', 'rule-input', 'assessment-input'].map(name => `schemas/${name}.schema.json`),
  ...['installation', 'architecture', 'security', 'tool-contract', 'analysis', 'standards', 'limitations', 'plan', 'public-release-checklist', 'vault-layout']
    .map(name => `docs/${name}.md`),
];
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function unquote(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

// The authored frontmatter uses single-line scalar fields and comma-separated
// tool lists. Fail on unsupported YAML instead of partially validating it.
function frontmatter(text, name, fail) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) { fail(`${name}: missing opening frontmatter.`); return {}; }
  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const entry = /^([a-z][a-z0-9-]*):[ \t]*(.*)$/.exec(line);
    if (!entry || /^[>|]/.test(entry[2])) { fail(`${name}: use supported single-line frontmatter fields.`); continue; }
    if (Object.hasOwn(result, entry[1])) fail(`${name}: duplicate frontmatter field ${entry[1]}.`);
    result[entry[1]] = unquote(entry[2]);
  }
  return result;
}

function toolList(value, name, fail) {
  if (typeof value !== 'string' || !value.trim()) { fail(`${name}: missing explicit tool allowlist.`); return []; }
  const text = value.trim().replace(/^\[/, '').replace(/\]$/, '');
  const tools = text.split(',').map(unquote);
  if (tools.some(tool => !tool || !/^mcp__plugin_edw-doc_vault__vault_[a-z]+$/.test(tool))) {
    fail(`${name}: tools must be exact broker names; native tools and wildcards are forbidden.`);
  }
  if (new Set(tools).size !== tools.length) fail(`${name}: duplicate tool in allowlist.`);
  return tools;
}

export function checkPackage(root = PACKAGE_ROOT) {
  root = fs.realpathSync(root);
  const errors = [];
  const fail = message => errors.push(message);
  const files = new Set();
  const documents = new Map();
  const json = new Map();

  function checkedFile(relative, { directory = false, base = root } = {}) {
    if (typeof relative !== 'string' || !relative || relative.includes('\0') || path.isAbsolute(relative) || /^[A-Za-z]:/.test(relative)) {
      throw new Error('Path must be package-relative.');
    }
    const absolute = path.resolve(base, relative);
    const local = path.relative(base, absolute);
    if (!local || local === '..' || local.startsWith(`..${path.sep}`) || path.isAbsolute(local)) throw new Error('Path leaves the package.');
    let current = base;
    for (const part of local.split(path.sep)) {
      current = path.join(current, part);
      if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Symbolic links and junctions are not supported package assets.');
    }
    const stat = fs.statSync(absolute);
    if (directory ? !stat.isDirectory() : !stat.isFile()) throw new Error(`Expected ${directory ? 'a directory' : 'a file'}.`);
    return absolute;
  }

  function read(relative, { base = root, label = relative } = {}) {
    try { return fs.readFileSync(checkedFile(relative, { base }), 'utf8'); }
    catch (error) { fail(`${label}: ${error.message}`); return null; }
  }

  function readJson(relative, { base = root, label = relative } = {}) {
    const text = read(relative, { base, label });
    if (text === null) return null;
    try {
      const value = JSON.parse(text);
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        fail(`${label}: JSON root must be an object.`);
        return null;
      }
      json.set(label, value);
      return value;
    }
    catch (error) { fail(`${label}: invalid JSON (${error.message}).`); return null; }
  }

  function walk(relative) {
    let absolute;
    try { absolute = checkedFile(relative, { directory: true }); }
    catch (error) { fail(`${relative}: ${error.message}`); return; }
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const item = `${relative}/${entry.name}`;
      if (entry.isSymbolicLink()) { fail(`${item}: linked package assets are unsupported.`); continue; }
      if (entry.isDirectory()) walk(item);
      else if (entry.isFile() && /\.(?:md|json)$/.test(item)) files.add(item);
    }
  }

  for (const file of REQUIRED) {
    try { checkedFile(file); }
    catch (error) { fail(`${file}: required asset unavailable (${error.message}).`); }
  }
  for (const folder of ASSET_ROOTS) walk(folder);
  files.add('README.md');
  files.add('GET-STARTED.md');

  const pkg = readJson('package.json');
  const plugin = readJson('.claude-plugin/plugin.json');
  // A standalone package owns its catalog. A toolkit may keep its catalog at
  // the toolkit root, but only the explicit plugins/<folder> layout is trusted;
  // never search arbitrary ancestors or inspect other plugins' assets.
  const catalogRoots = [root];
  if (path.basename(path.dirname(root)) === 'plugins') catalogRoots.push(path.dirname(path.dirname(root)));
  const catalogs = catalogRoots.filter(base => {
    try { fs.lstatSync(path.join(base, '.claude-plugin', 'marketplace.json')); return true; }
    catch (error) {
      if (error.code !== 'ENOENT') fail(`Marketplace catalog at ${base} could not be inspected: ${error.message}`);
      return false;
    }
  }).map(base => ({ base, label:path.relative(root, path.join(base, '.claude-plugin', 'marketplace.json')).split(path.sep).join('/') }));
  if (!catalogs.length) fail('A marketplace catalog is required in this package or at the toolkit root for plugins/<folder> packages.');
  const mcp = readJson('.mcp.json');
  const hooks = readJson('hooks/hooks.json');
  if (pkg) {
    if (!VERSION.test(pkg.version || '')) fail('package.json: version must be a semantic version.');
    if (pkg.type !== 'module') fail('package.json: runtime requires type "module".');
    if (pkg.engines?.node !== '>=20') fail('package.json: expected Node engine >=20.');
    if (pkg.scripts?.check !== 'node scripts/check-package.mjs') fail('package.json: check must invoke this script.');
    if (pkg.bin?.['edw-doc'] !== 'scripts/cli.mjs') fail('package.json: edw-doc binary must point to the bundled CLI.');
    for (const key of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
      if (pkg[key] && Object.keys(pkg[key]).length) fail(`package.json: ${key} violates the dependency-free runtime contract.`);
    }
  }
  if (plugin) {
    if (plugin.name !== 'edw-doc') fail('Plugin name must remain edw-doc to match namespaced agents and tools.');
    if (!VERSION.test(plugin.version || '')) fail('Plugin version must be a semantic version.');
    if (pkg && plugin.version !== pkg.version) fail('Plugin and package versions must match.');
    if (typeof plugin.description !== 'string' || !plugin.description.trim()) fail('Plugin description is required.');
  }
  for (const catalog of catalogs) {
    const marketplace = readJson('.claude-plugin/marketplace.json', catalog);
    if (!marketplace) continue;
    const catalogFail = message => fail(`${catalog.label}: ${message}`);
    if (typeof marketplace.name !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(marketplace.name)) catalogFail('Marketplace name must be a lowercase hyphen-separated slug.');
    if (typeof marketplace.owner?.name !== 'string' || !marketplace.owner.name.trim()) catalogFail('Marketplace owner name is required.');
    if (!Array.isArray(marketplace.plugins)) { catalogFail('Marketplace plugins must be an array.'); continue; }
    const entries = marketplace.plugins.filter(entry => entry && typeof entry === 'object' && !Array.isArray(entry) && entry.name === 'edw-doc');
    if (entries.length !== 1) { catalogFail('Marketplace must contain exactly one edw-doc plugin entry.'); continue; }
    const entry = entries[0];
    if (entry.name !== plugin?.name) catalogFail('Marketplace plugin name must match the plugin manifest.');
    try {
      if (typeof entry.source !== 'string' || !(entry.source === '.' || entry.source.startsWith('./')) || /[\\\x00-\x1f]/.test(entry.source) || entry.source.split('/').includes('..')) {
        throw new Error('Source must be a local ./path without parent traversal.');
      }
      const source = path.resolve(catalog.base, entry.source);
      if (source !== catalog.base) checkedFile(entry.source, { base:catalog.base, directory:true });
      if (fs.realpathSync(source) !== root) throw new Error('Source must resolve exactly to this plugin package folder.');
    } catch (error) { catalogFail(`Invalid edw-doc source: ${error.message}`); }
    // A marketplace may omit version and use the plugin manifest as authority.
    if (entry.version !== undefined && entry.version !== plugin?.version) catalogFail('Marketplace entry version must match the plugin version when present.');
  }
  if (mcp) {
    const servers = mcp.mcpServers;
    if (!servers || Object.keys(servers).length !== 1 || !servers.vault) fail('MCP registration must expose only the local vault server.');
    else {
      if (servers.vault.command !== 'node' || JSON.stringify(servers.vault.args) !== JSON.stringify(['${CLAUDE_PLUGIN_ROOT}/scripts/mcp.mjs'])) {
        fail('MCP registration must invoke the bundled Node broker directly.');
      }
      if (servers.vault.env !== undefined && (!servers.vault.env || typeof servers.vault.env !== 'object' || Array.isArray(servers.vault.env) || Object.entries(servers.vault.env).some(([key, value]) => !['EDW_DOC_ROOT', 'DOC_VAULT_ROOT'].includes(key) || typeof value !== 'string'))) {
        fail('MCP environment overrides are limited to an explicit EDW_DOC_ROOT string (or the legacy DOC_VAULT_ROOT alias).');
      }
    }
  }
  if (hooks) {
    const expected=['SessionStart','UserPromptSubmit','PostToolUse','Stop','SubagentStop','SessionEnd'];
    if (!hooks.hooks || Object.keys(hooks.hooks).length !== expected.length || expected.some(event=>!Array.isArray(hooks.hooks[event]))) fail('Expected only the documented maintenance and authorization lifecycle hooks.');
    else for(const event of expected) {
      const groups = hooks.hooks[event];
      const scripts=event==='SessionStart'?['run-lifecycle','session-start']:['UserPromptSubmit','Stop'].includes(event)?['run-lifecycle','maintenance-hook']:event==='PostToolUse'?['maintenance-hook']:['run-lifecycle'];
      if (groups.length !== 1 || !Array.isArray(groups[0]?.hooks) || groups[0].hooks.length !== scripts.length) fail(`Unexpected ${event} hook commands.`);
      else {
        for (const [index,script] of scripts.entries()) {
          const hook = groups[0].hooks[index];
          if (hook?.type !== 'command' || hook?.command !== `node "\${CLAUDE_PLUGIN_ROOT}/scripts/${script}.mjs"`) fail(`${event} must invoke only its bundled lifecycle scripts.`);
          if (hook?.async || hook?.asyncRewake) fail(`${event} must use the reviewed synchronous checkpoint configuration.`);
          if (!Number.isFinite(hook?.timeout) || hook.timeout <= 0 || hook.timeout > (script==='run-lifecycle'?5:30)) fail(`${event} requires a bounded timeout.`);
        }
        const matcher=event==='SubagentStop'?'^edw-doc:(curator|standards|reviewer)$':undefined;
        if (groups[0].matcher!==matcher) fail(`${event} has an unexpected matcher.`);
      }
    }
  }

  for (const file of [...files].sort()) {
    if (file.endsWith('.json')) { readJson(file); continue; }
    const text = read(file);
    if (text !== null) documents.set(file, text);
  }
  const agents = new Map();
  for (const [file, text] of documents) {
    if (!/^agents\/[^/]+\.md$/.test(file)) continue;
    const metadata = frontmatter(text, file, fail);
    const name = path.posix.basename(file, '.md');
    if (metadata.name !== name) fail(`${file}: agent name must match the filename.`);
    if (!metadata.description?.trim()) fail(`${file}: description is required.`);
    if (metadata.background !== 'false') fail(`${file}: background must be false.`);
    const tools = toolList(metadata.tools, file, fail);
    const expected = AGENT_TOOLS[name]?.map(tool => `${PREFIX}${tool}`);
    if (!expected) fail(`${file}: agent role has no reviewed permission contract.`);
    else {
      for (const tool of tools) if (!expected.includes(tool)) fail(`${file}: tool is outside this role's allowlist: ${tool}.`);
      for (const tool of expected) if (!tools.includes(tool)) fail(`${file}: required broker tool is missing: ${tool}.`);
    }
    agents.set(name, new Set(tools));
  }
  let skillCount = 0;
  for (const [file, text] of documents) {
    if (!/^skills\/[^/]+\/SKILL\.md$/.test(file)) continue;
    skillCount++;
    const metadata = frontmatter(text, file, fail);
    const name = file.split('/')[1];
    if (metadata.name !== name) fail(`${file}: skill name must match its folder.`);
    if (!metadata.description?.trim()) fail(`${file}: description is required.`);
    if (metadata.context !== 'fork') fail(`${file}: context must be fork.`);
    if (metadata.background !== 'false') fail(`${file}: background must be false.`);
    const agent = /^edw-doc:([a-z0-9-]+)$/.exec(metadata.agent || '')?.[1];
    if (!agent || !agents.has(agent)) fail(`${file}: agent must reference a bundled namespaced agent.`);
    const expectedAgent = name === 'review' ? 'reviewer' : name === 'standards' ? 'standards' : 'curator';
    if (SKILLS.includes(name) && agent !== expectedAgent) fail(`${file}: expected ${expectedAgent} agent.`);
    const expectedGrants=['vault_begin',...(COMMAND_TOOLS[name]||[]),'vault_end'].map(tool=>`${PREFIX}${tool}`);
    const grants=toolList(metadata['allowed-tools'],file,fail);
    if (expectedGrants.length!==grants.length || expectedGrants.some(tool=>!grants.includes(tool))) fail(`${file}: allowed-tools must exactly match this command's approval scope.`);
    for (const field of ['tools', 'allowed-tools']) {
      if (metadata[field] === undefined) continue;
      for (const tool of toolList(metadata[field], file, fail)) {
        if (!agents.get(agent)?.has(tool)) fail(`${file}: skill tool exceeds the referenced agent's permission contract: ${tool}.`);
      }
    }
  }

  function validateReference(owner, target, label) {
    try { checkedFile(target); }
    catch (error) { fail(`${owner}: ${label} ${target} is unavailable (${error.message}).`); }
  }
  for (const [file, text] of documents) {
    // References inside external research URLs belong to those projects, not
    // this bundle. Markdown local links are checked separately below.
    const localReferences = text.replace(/https?:\/\/[^\s)>"']+/g, '');
    for (const match of localReferences.matchAll(/\b(?:policies|workflows|packs|templates|docs|schemas)\/[A-Za-z0-9_./-]+\.(?:md|json)\b/g)) {
      if (!CONTEXT_ROOTS.has(match[0].split('/')[0])) continue;
      validateReference(file, match[0], 'bundled context');
    }
    // Only authored Markdown links are checked. Do not inspect generated notes
    // or treat source links supplied by a scanned repository as package links.
    for (const match of text.matchAll(/!?\[[^\]\r\n]*\]\((<[^>\r\n]+>|[^)\r\n]+)\)/g)) {
      let target = match[1].trim();
      if (target.startsWith('<')) target = target.slice(1, -1);
      else target = target.replace(/\s+(?:"[^"]*"|'[^']*')\s*$/, '');
      if (/^(?:https?:|mailto:)/i.test(target) || target.startsWith('#')) continue;
      if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(target)) { fail(`${file}: unsupported local-link protocol.`); continue; }
      target = target.split('#')[0].split('?')[0];
      if (!target) continue;
      try { target = decodeURIComponent(target); }
      catch { fail(`${file}: malformed URL encoding in local link.`); continue; }
      if (path.isAbsolute(target) || /^[A-Za-z]:/.test(target)) { fail(`${file}: local documentation links must be package-relative.`); continue; }
      validateReference(file, path.posix.join(path.posix.dirname(file), target.replaceAll('\\', '/')), 'relative link');
    }
  }
  function refs(value, owner) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.$ref === 'string' && !value.$ref.startsWith('#')) {
      if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value.$ref)) fail(`${owner}: schema references must use bundled local files.`);
      else validateReference(owner, path.posix.join(path.posix.dirname(owner), value.$ref.split('#')[0]), 'schema reference');
    }
    for (const child of Object.values(value)) if (typeof child === 'object') refs(child, owner);
  }
  for (const [file, value] of json) if (file.startsWith('schemas/')) refs(value, file);

  return { ok: errors.length === 0, version: plugin?.version || null, documents: documents.size, json_files: json.size, agents: agents.size, skills: skillCount, errors: [...new Set(errors)] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = checkPackage();
    if (result.ok) {
      process.stdout.write(`Package check passed: v${result.version}; ${result.documents} documents, ${result.json_files} JSON files, ${result.agents} agents, ${result.skills} skills.\n`);
      process.stdout.write('Checked bundled manifests, versions, assets, permissions, context references, and documentation links. This does not validate a running Claude Code host.\n');
    } else {
      for (const error of result.errors) process.stderr.write(`- ${error}\n`);
      process.stderr.write(`Package check failed with ${result.errors.length} issue(s).\n`);
      process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`Package check could not complete: ${error.message}\n`);
    process.exitCode = 1;
  }
}
