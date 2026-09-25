import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPackage } from '../scripts/check-package.mjs';
import { temporaryDirectory } from './helpers.mjs';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = [
  '.claude-plugin', '.mcp.json', 'package.json', 'README.md', 'GET-STARTED.md', 'BUSINESS-REQUIREMENTS.md',
  'agents', 'skills', 'policies', 'workflows', 'packs', 'templates', 'schemas', 'docs', 'hooks', 'scripts', 'src', 'evaluations'
];
const catalogPath = root => path.join(root, '.claude-plugin', 'marketplace.json');
const writeCatalog = (root, value) => {
  fs.mkdirSync(path.dirname(catalogPath(root)), { recursive:true });
  fs.writeFileSync(catalogPath(root), `${JSON.stringify(value, null, 2)}\n`);
};
const catalog = source => ({
  name:'edw-doc-tools', owner:{ name:'Team' },
  plugins:[{ name:'edw-doc', source }, { name:'other-agent', source:'./plugins/not-installed-here' }]
});
async function toolkit(t, { folder = 'edw-doc', parent = 'plugins', localCatalog = false } = {}) {
  const root = await temporaryDirectory(t, 'edw-doc-toolkit-package-');
  const pluginRoot = path.join(root, parent, folder);
  fs.mkdirSync(pluginRoot, { recursive:true });
  // Copy authored distribution assets only; never copy .git, scanned targets,
  // local generated vaults, installed modules, or the user's workspace.
  for (const asset of assets) fs.cpSync(path.join(sourceRoot, asset), path.join(pluginRoot, asset), { recursive:true });
  if (!localCatalog) fs.unlinkSync(catalogPath(pluginRoot));
  writeCatalog(root, catalog(`./${parent}/${folder}`));
  return { root, pluginRoot };
}
const assertValid = root => {
  const report = checkPackage(root);
  assert.equal(report.ok, true, JSON.stringify(report.errors, null, 2));
  return report;
};
const assertInvalid = (root, pattern) => {
  const report = checkPackage(root);
  assert.equal(report.ok, false);
  assert.match(report.errors.join('\n'), pattern);
};

test('the current standalone distribution remains valid', () => {
  assertValid(sourceRoot);
});

for (const folder of ['edw-doc', 'doc-vault']) {
  test(`a toolkit catalog can install edw-doc from plugins/${folder} without a plugin-local catalog`, async t => {
    const { pluginRoot } = await toolkit(t, { folder });
    assertValid(pluginRoot);
  });
}

test('both catalogs are validated when standalone and toolkit catalogs coexist', async t => {
  const { root, pluginRoot } = await toolkit(t, { localCatalog:true });
  assertValid(pluginRoot);
  writeCatalog(root, catalog('./'));
  assertInvalid(pluginRoot, /\.\.\/\.\.\/\.claude-plugin\/marketplace\.json: Invalid edw-doc source/);
  writeCatalog(root, catalog('./plugins/edw-doc'));
  writeCatalog(pluginRoot, catalog('./wrong-location'));
  assertInvalid(pluginRoot, /\.claude-plugin\/marketplace\.json: Invalid edw-doc source/);
});

test('toolkit catalog names can differ from the package name while retaining slug validation', async t => {
  const { root, pluginRoot } = await toolkit(t);
  writeCatalog(root, { ...catalog('./plugins/edw-doc'), name:'edw-ai-toolkit' });
  assertValid(pluginRoot);
  writeCatalog(root, { ...catalog('./plugins/edw-doc'), name:'Toolkit With Spaces' });
  assertInvalid(pluginRoot, /Marketplace name must be a lowercase hyphen-separated slug/);
});

test('the toolkit catalog must identify exactly one edw-doc entry', async t => {
  const { root, pluginRoot } = await toolkit(t);
  const duplicate = catalog('./plugins/edw-doc');
  duplicate.plugins.push({ name:'edw-doc', source:'./plugins/edw-doc' });
  writeCatalog(root, duplicate);
  assertInvalid(pluginRoot, /exactly one edw-doc plugin entry/);
  writeCatalog(root, { ...catalog('./plugins/edw-doc'), plugins:[{ name:'other-agent', source:'./elsewhere' }] });
  assertInvalid(pluginRoot, /exactly one edw-doc plugin entry/);
});

test('source paths must point exactly to this package and cannot traverse parents', async t => {
  const { root, pluginRoot } = await toolkit(t);
  for (const source of ['./', './plugins/missing', './plugins/edw-doc/../../plugins/edw-doc', '../plugins/edw-doc', pluginRoot]) {
    writeCatalog(root, catalog(source));
    assertInvalid(pluginRoot, /Invalid edw-doc source/);
  }
});

test('a missing catalog is rejected and unrelated ancestors are not searched', async t => {
  const { root, pluginRoot } = await toolkit(t);
  fs.unlinkSync(catalogPath(root));
  assertInvalid(pluginRoot, /A marketplace catalog is required/);
  const outsideLayout = await toolkit(t, { parent:'components' });
  assertInvalid(outsideLayout.pluginRoot, /A marketplace catalog is required/);
});

test('marketplace versions must match the plugin version when declared', async t => {
  const { root, pluginRoot } = await toolkit(t);
  const value = catalog('./plugins/edw-doc');
  value.plugins[0].version = '999.0.0';
  writeCatalog(root, value);
  assertInvalid(pluginRoot, /Marketplace entry version must match the plugin version/);
});

test('marketplace source aliases through junctions or symbolic links are rejected', async t => {
  const { root, pluginRoot } = await toolkit(t);
  try { fs.symlinkSync(pluginRoot, path.join(root, 'plugins', 'alias'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip('Directory links unavailable'); throw error; }
  writeCatalog(root, catalog('./plugins/alias'));
  assertInvalid(pluginRoot, /Symbolic links and junctions are not supported package assets/);
});

test('toolkit catalog directories cannot be links to external content', async t => {
  const { root, pluginRoot } = await toolkit(t);
  const external = await temporaryDirectory(t, 'edw-doc-external-catalog-');
  fs.writeFileSync(path.join(external, 'marketplace.json'), JSON.stringify(catalog('./plugins/edw-doc')));
  fs.unlinkSync(catalogPath(root));
  fs.rmdirSync(path.dirname(catalogPath(root)));
  try { fs.symlinkSync(external, path.dirname(catalogPath(root)), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip('Directory links unavailable'); throw error; }
  assertInvalid(pluginRoot, /Symbolic links and junctions are not supported package assets/);
});
