import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
export const posix = value => value.split(path.sep).join('/');

export function relativePath(value) {
  if (typeof value !== 'string' || !value || value.length > 2048 || /[\\\x00-\x1f:]/.test(value) || path.isAbsolute(value)) {
    throw new Error('A nonempty repository-relative path with forward slashes is required.');
  }
  const parts = value.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) {
    throw new Error('Unsafe or unsupported path.');
  }
  return parts.join('/');
}

export function validateVaultName(name) {
  if (!/^[a-z][a-z0-9-]{2,63}$/.test(name) || name === 'node-modules') throw new Error('Invalid vault directory name.');
  return name;
}

export function rootDirectory(root) {
  const real = fs.realpathSync(path.resolve(root));
  if (!fs.statSync(real).isDirectory()) throw new Error('Repository root must be a directory.');
  return real;
}

// Reject links/junctions at every existing component. This is a broker check,
// not a substitute for OS isolation against a hostile concurrent filesystem writer.
export function checkedPath(root, relative, { allowMissing = false, write = false } = {}) {
  const parts = relativePath(relative).split('/');
  let current = root;
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    let stat;
    try { stat = fs.lstatSync(current); }
    catch (error) {
      if (allowMissing && error.code === 'ENOENT') continue;
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error('Symbolic links and junctions are outside the allowed path policy.');
    if (i < parts.length - 1 && !stat.isDirectory()) throw new Error('A path parent is not a directory.');
    if (write && stat.isFile() && stat.nlink > 1) throw new Error('Refusing to write a hard-linked file.');
  }
  const relativeResolved = path.relative(root, current);
  if (relativeResolved.startsWith('..') || path.isAbsolute(relativeResolved)) throw new Error('Path escapes the allowed root.');
  return current;
}

export function makeDirectory(root, relative) {
  let current = '';
  for (const part of relativePath(relative).split('/')) {
    current = current ? `${current}/${part}` : part;
    const absolute = checkedPath(root, current, { allowMissing: true, write: true });
    if (!fs.existsSync(absolute)) fs.mkdirSync(absolute);
    if (!fs.lstatSync(absolute).isDirectory()) throw new Error('Expected an ordinary directory.');
  }
}

export function readBytes(root, relative, limit = 4 * 1024 * 1024) {
  const absolute = checkedPath(root, relative);
  const descriptor = fs.openSync(absolute, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile()) throw new Error('Only ordinary files may be read.');
    if (stat.size > limit) throw new Error(`File exceeds the ${limit}-byte inspection limit.`);
    const bytes = fs.readFileSync(descriptor);
    if (bytes.length > limit) throw new Error('File grew beyond the inspection limit.');
    return bytes;
  } finally { fs.closeSync(descriptor); }
}

export function writeAtomic(root, relative, content) {
  relative = relativePath(relative);
  const parent = path.posix.dirname(relative);
  if (parent !== '.') makeDirectory(root, parent);
  const destination = checkedPath(root, relative, { allowMissing: true, write: true });
  const temporaryRelative = `${relative}.tmp-${crypto.randomBytes(8).toString('hex')}`;
  const temporary = checkedPath(root, temporaryRelative, { allowMissing: true, write: true });
  try {
    fs.writeFileSync(temporary, content, { flag: 'wx', mode: 0o600 });
    checkedPath(root, relative, { allowMissing: true, write: true });
    fs.renameSync(temporary, destination);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(checkedPath(root, temporaryRelative, { write: true }));
  }
}

export function removeOwnedFile(root, relative) {
  const absolute = checkedPath(root, relative, { allowMissing: true, write: true });
  if (!fs.existsSync(absolute)) return;
  if (!fs.lstatSync(absolute).isFile()) throw new Error('Only owned regular files can be retired.');
  fs.unlinkSync(absolute);
}

export function ensureIgnore(root, vaultName) {
  const ignorePath = checkedPath(root, '.gitignore', { allowMissing: true, write: true });
  const original = fs.existsSync(ignorePath) ? readBytes(root, '.gitignore', 1024 * 1024) : Buffer.alloc(0);
  const text = original.toString('utf8');
  const rule = `/${vaultName}/`;
  // Append the exact root rule after any later negations. Leave other bytes intact.
  const meaningful = text.split(/\r?\n/).filter(line => line.trim() && !line.startsWith('#'));
  const existing=meaningful.lastIndexOf(rule);
  if (existing>=0&&!meaningful.slice(existing+1).some(line=>line.startsWith('!'))) return false;
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const suffix = `${text && !text.endsWith('\n') ? eol : ''}${rule}${eol}`;
  const fd = fs.openSync(ignorePath, fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_CREAT | (fs.constants.O_NOFOLLOW || 0), 0o600);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.nlink > 1) throw new Error('Ignore file must be an ordinary, unlinked file.');
    fs.writeSync(fd, suffix);
  } finally { fs.closeSync(fd); }
  return true;
}
