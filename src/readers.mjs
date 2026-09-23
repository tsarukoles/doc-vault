import { inflateRawSync } from 'node:zlib';

// These readers inspect data as text/bytes. They never load a workbook engine,
// evaluate formulas, execute macros, or interpret repository scripts.
const MAX_ENTRIES = 2048;
const MAX_XML_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 24 * 1024 * 1024;

function unescapeXml(value = '') {
  return value.replace(/&(?:amp|lt|gt|quot|apos);/g, (entity) => ({
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
  }[entity]));
}

function attrs(tag) {
  const result = {};
  for (const match of tag.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    result[match[1]] = unescapeXml(match[2] ?? match[3]);
  }
  return result;
}

function zipXmlEntries(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) throw new Error('Workbook bytes unavailable or truncated.');
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error('Workbook ZIP directory missing.');
  const entries = buffer.readUInt16LE(end + 10);
  if (buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6)) throw new Error('Multipart workbooks are unsupported.');
  if (entries > MAX_ENTRIES || entries === 65535) throw new Error('Workbook entry limit exceeded or ZIP64 unsupported.');
  const offset = buffer.readUInt32LE(end + 16);
  const directorySize = buffer.readUInt32LE(end + 12);
  if (offset + directorySize > end) throw new Error('Workbook directory bounds are invalid.');
  const result = new Map();
  let cursor = offset;
  let total = 0;
  for (let i = 0; i < entries; i++) {
    if (cursor + 46 > end || buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Invalid workbook directory entry.');
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const compressed = buffer.readUInt32LE(cursor + 20);
    const expanded = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const local = buffer.readUInt32LE(cursor + 42);
    if (cursor + 46 + nameLength + extraLength + commentLength > end) throw new Error('Truncated workbook directory entry.');
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    cursor += 46 + nameLength + extraLength + commentLength;
    if (!/^xl\/(?:workbook\.xml|_rels\/workbook\.xml\.rels|worksheets\/[^/]+\.xml)$/.test(name)) continue;
    if (flags & 1) throw new Error('Encrypted workbooks are unsupported.');
    if (![0, 8].includes(method)) throw new Error('Unsupported workbook compression.');
    if (expanded > MAX_XML_BYTES || (total += expanded) > MAX_TOTAL_BYTES) throw new Error('Workbook XML size limit exceeded.');
    if (local + 30 > buffer.length || buffer.readUInt32LE(local) !== 0x04034b50) throw new Error('Invalid workbook local entry.');
    const dataOffset = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    if (dataOffset + compressed > buffer.length) throw new Error('Truncated workbook data.');
    const data = buffer.subarray(dataOffset, dataOffset + compressed);
    const decoded = method === 0 ? data : inflateRawSync(data, { maxOutputLength: MAX_XML_BYTES });
    if (decoded.length !== expanded) throw new Error('Workbook expanded length mismatch.');
    const xml = decoded.toString('utf8');
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Workbook XML entities are unsupported.');
    result.set(name, xml);
  }
  return result;
}

export function inspectWorkbook(bytes) {
  try {
    const entries = zipXmlEntries(bytes);
    const workbook = entries.get('xl/workbook.xml');
    if (!workbook) throw new Error('Workbook manifest missing.');
    const relationships = new Map();
    for (const match of (entries.get('xl/_rels/workbook.xml.rels') ?? '').matchAll(/<Relationship\b[^<>]*\/?\s*>/g)) {
      const a = attrs(match[0]);
      if (a.TargetMode === 'External' || !a.Target) continue;
      let name = a.Target.replace(/^\//, '');
      if (!name.startsWith('xl/')) name = `xl/${name}`;
      if (name.split('/').includes('..')) continue;
      relationships.set(a.Id, name);
    }
    const sheets = [];
    for (const match of workbook.matchAll(/<sheet\b[^<>]*\/?\s*>/g)) {
      const a = attrs(match[0]);
      const xml = entries.get(relationships.get(a['r:id']));
      if (!xml) { sheets.push({ name: a.name || '(unnamed)', available: false }); continue; }
      const types = Object.create(null);
      let cellCount = 0;
      let formulaCount = 0;
      let firstCell;
      const cells = [];
      // Scan opening tags without a lazy body expression. Repeated unmatched
      // cell starts in malformed XML must not trigger quadratic rescanning.
      for (const cell of xml.matchAll(/<c\b([^<>]*)>/g)) {
        const ca = attrs(cell[1]);
        cellCount++;
        const type = ca.t || 'numeric-or-default';
        types[type] = (types[type] || 0) + 1;
        if (!firstCell && /^[A-Z]{1,4}[1-9]\d{0,7}$/.test(ca.r || '')) firstCell = ca.r;
        if (cells.length < 512 && /^[A-Z]{1,4}[1-9]\d{0,7}$/.test(ca.r || '')) cells.push({ address: ca.r, type });
      }
      for (const _ of xml.matchAll(/<f(?:\s|>)/g)) formulaCount++;
      sheets.push({ name: a.name || '(unnamed)', available: true, cellCount, formulaCount, types, firstCell, cells, cellsTruncated: cellCount > cells.length });
    }
    return { sheets, limitations: ['Workbook structure only: cell values and formula expressions are omitted; formulas are not evaluated.'] };
  } catch (error) {
    return { sheets: [], limitations: [`Workbook not inspected: ${error.message}`] };
  }
}

export function inspectDelimited(text, extension) {
  const first = text.split(/\r?\n/, 1)[0] || '';
  const candidates = extension === '.tsv' ? ['\t'] : [',', ';', '\t', '|'];
  const delimiter = candidates.reduce((best, next) => first.split(next).length > first.split(best).length ? next : best);
  const rows = [];
  let row = [], value = '', quoted = false, malformed = false;
  // Input size has already been limited by discovery. Avoid retaining data rows.
  let rowCount = 0, minColumns = Infinity, maxColumns = 0;
  function finish() {
    row.push(value); value = '';
    if (row.some((item) => item.length)) {
      rowCount++; minColumns = Math.min(minColumns, row.length); maxColumns = Math.max(maxColumns, row.length);
      if (rows.length === 0) rows.push(row);
    }
    row = [];
  }
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else if (quoted || value.length === 0) quoted = !quoted;
      else value += char;
    } else if (char === delimiter && !quoted) { row.push(value); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[i + 1] === '\n') i++; finish(); }
    else value += char;
  }
  if (value || row.length) finish();
  if (quoted) malformed = true;
  const firstRow = rows[0] || [];
  // Header detection is deliberately conservative. Never publish arbitrary rows.
  const probableHeader = firstRow.length > 1 && firstRow.length <= 64 && firstRow.every((v) => /^[A-Za-z_][\w .-]{0,63}$/.test(v));
  return { delimiter: delimiter === '\t' ? 'tab' : delimiter, recordCount: rowCount, minColumns: rowCount ? minColumns : 0, maxColumns,
    headers: probableHeader ? firstRow : [], probableHeader, malformed,
    limitations: ['The file role and column semantics require evidence from its consumers; delimiter and header detection are heuristic. Data row values are omitted.'] };
}
