import { mkdtemp, cp, readdir, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const fixtureDirectory = fileURLToPath(new URL('../fixtures/', import.meta.url));

export async function temporaryDirectory(t, prefix = 'doc-vault-test-') {
  const parent = await realpath(tmpdir());
  const directory = await mkdtemp(path.join(parent, prefix));
  t.after(async () => {
    const target = await realpath(directory);
    if (path.dirname(target) !== parent || !path.basename(target).startsWith(prefix)) {
      throw new Error(`Refusing cleanup outside the newly created test directory: ${target}`);
    }
    await rm(target, { recursive: true, force: true });
  });
  return directory;
}

export async function fixture(t, name) {
  const root = await temporaryDirectory(t);
  await cp(path.join(fixtureDirectory, name), root, { recursive: true });
  return root;
}

export async function hashes(root, { exclude = [] } = {}) {
  const output = {};
  async function visit(directory, relative = '') {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const local = relative ? `${relative}/${entry.name}` : entry.name;
      if (exclude.some((name) => local === name || local.startsWith(`${name}/`))) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) await visit(absolute, local);
      else if (entry.isFile()) output[local] = createHash('sha256').update(await readFile(absolute)).digest('hex');
    }
  }
  await visit(root);
  return output;
}

export async function allRecords(engine) {
  const items = [];
  for (let offset = 0; ; offset += 500) {
    const result = await engine.list({ offset, limit: 500 });
    items.push(...result.items);
    if (items.length >= result.total) return items;
  }
}

export async function sourceNote(engine, sourcePath) {
  const record = (await allRecords(engine)).find((item) => item.path === sourcePath);
  if (!record?.note_path) throw new Error(`No generated note for ${sourcePath}`);
  return engine.note({ path: record.note_path });
}

export function referencedPaths(value) {
  // API relationships may carry evidence or node records; inspect data, not prose.
  const paths = new Set();
  function visit(item) {
    if (typeof item === 'string') paths.add(item.replaceAll('\\', '/'));
    else if (Array.isArray(item)) item.forEach(visit);
    else if (item && typeof item === 'object') Object.values(item).forEach(visit);
  }
  visit(value);
  return paths;
}
