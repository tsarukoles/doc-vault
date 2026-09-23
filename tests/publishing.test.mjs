import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createEngine } from '../src/engine.mjs';
import { fixture, sourceNote } from './helpers.mjs';
import { workbookZip } from './workbook-fixture.mjs';

async function draft(engine, overrides = {}) {
  const source = await engine.read({ path: 'application/registry.py', start_line: 1, end_line: 6 });
  return {
    kind: 'file',
    title: 'Validation registry',
    slug: 'validation-registry',
    summary: 'The registry maps control names to imported validation functions.',
    source_paths: ['application/registry.py'],
    sections: [{
      heading: 'Responsibilities',
      text: 'CONTROLS selects two validation functions imported from the sibling rules module.',
      evidence: [{ path: source.path, start_line: 1, end_line: 6, sha256: source.sha256 }],
    }],
    review_status: 'draft',
    ...overrides,
  };
}

test('publish accepts current evidence and rejects stale, missing, or unsupported evidence', async (t) => {
  const root = await fixture(t, 'data-controls');
  const engine = await createEngine(root);
  await engine.scan();
  const input = await draft(engine);
  const published = await engine.publish(input);
  assert.ok(published.path);
  const note = await sourceNote(engine, 'application/registry.py');
  assert.match(note.text, /CONTROLS selects two/);

  await assert.rejects(engine.publish({ ...input, sections: [{ ...input.sections[0], evidence: [] }] }));
  await assert.rejects(engine.publish({ ...input, source_paths: ['missing.py'] }));
  await assert.rejects(engine.publish({ ...input, sections: [{ ...input.sections[0], evidence: [{ ...input.sections[0].evidence[0], sha256: '0'.repeat(64) }] }] }));
  await assert.rejects(engine.publish({ ...input, sections: [{ ...input.sections[0], evidence: [{ ...input.sections[0].evidence[0], start_line: 1, end_line: 9999 }] }] }));
  await assert.rejects(engine.publish({ ...input, kind: 'arbitrary-root-file' }));
  const stable = await sourceNote(engine, 'application/registry.py');
  assert.equal(stable.sha256, note.sha256, 'Rejected publications must preserve the last valid note');
});

test('a changed shared dependency invalidates its related explanation', async (t) => {
  const root = await fixture(t, 'data-controls');
  const engine = await createEngine(root);
  await engine.scan();
  await engine.publish(await draft(engine));
  const before = await sourceNote(engine, 'application/registry.py');
  const rules = path.join(root, 'application', 'rules.py');
  await writeFile(rules, (await readFile(rules, 'utf8')).replace('record["amount"] >= 0', 'record["amount"] > 0'));
  await engine.refresh();
  const after = await sourceNote(engine, 'application/registry.py');
  assert.notEqual(after.sha256, before.sha256, 'A dependent note must be replaced or explicitly marked stale when its imported implementation changes');
  const packet = await engine.packet({ path: 'application/registry.py' });
  assert.ok(packet);
  const lint = await engine.lint();
  assert.equal(lint.ok, true, JSON.stringify(lint));
});

test('review applies to the exact observed note and cannot approve a replaced version', async (t) => {
  const root = await fixture(t, 'data-controls');
  const engine = await createEngine(root);
  await engine.scan();
  const note = await sourceNote(engine, 'application/registry.py');
  const source = await engine.read({ path: 'application/registry.py', start_line: 1, end_line: 6 });
  const review = {
    note_path: note.path,
    verdict: 'supported',
    reason: 'Checked the registry mapping against the current source.',
    expected_note_sha256: note.sha256,
    evidence: [{ path: source.path, start_line: 1, end_line: 6, sha256: source.sha256 }],
  };
  await engine.review(review);
  await engine.publish(await draft(engine));
  await assert.rejects(engine.review(review), /hash|stale|changed|match|version/i);
});

test('evidence collected before an uncommitted edit cannot publish as current', async (t) => {
  const root = await fixture(t, 'data-controls');
  const engine = await createEngine(root);
  await engine.scan();
  const input = await draft(engine);
  const note = await sourceNote(engine, 'application/registry.py');
  await writeFile(path.join(root, 'application', 'registry.py'), '\n# Local edit after evidence collection\n', { flag: 'a' });
  await assert.rejects(engine.publish(input), /changed|stale|snapshot|sync|hash/i);
  assert.equal((await engine.note({ path: note.path })).sha256, note.sha256);
});

test('workbook publication validates workbook, sheet, and cell evidence selectors', async (t) => {
  const root = await fixture(t, 'data-controls');
  await writeFile(path.join(root, 'config', 'example.xlsx'), workbookZip({
    'xl/workbook.xml': '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Rules" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>example</t></is></c></row></sheetData></worksheet>',
  }));
  const engine = await createEngine(root);
  await engine.scan();
  const source = await engine.read({ path: 'config/example.xlsx' });
  const baseEvidence = { path: source.path, sha256: source.sha256 };
  const input = {
    kind: 'file', title: 'Example workbook', summary: 'The inspected workbook contains a Rules worksheet.',
    source_paths: ['config/example.xlsx'],
    sections: [{ heading: 'Structure', text: 'The workbook has a Rules sheet with a stored cell at A1.', evidence: [
      { ...baseEvidence, selector: { kind: 'workbook' } },
      { ...baseEvidence, selector: { sheet: 'Rules' } },
      { ...baseEvidence, selector: { sheet: 'Rules', cell: 'A1' } },
    ] }],
  };
  const published = await engine.publish(input);
  assert.ok(published.path);
  const replaceEvidence = (selector) => ({ ...input, sections: [{ ...input.sections[0], evidence: [{ ...baseEvidence, selector }] }] });
  await assert.rejects(engine.publish(replaceEvidence({ sheet: 'Missing' })), /sheet|inspect/i);
  await assert.rejects(engine.publish(replaceEvidence({ sheet: 'Rules', cell: 'B99' })), /cell|inspect/i);
  await assert.rejects(engine.publish(replaceEvidence({})), /selector|sheet|workbook/i);
  assert.equal((await engine.lint()).ok, true);
});
