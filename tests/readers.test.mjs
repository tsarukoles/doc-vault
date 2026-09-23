import test from 'node:test';
import assert from 'node:assert/strict';
import { workbookZip } from './workbook-fixture.mjs';
import { inspectDelimited, inspectWorkbook } from '../src/readers.mjs';

const manifest = '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Example rules" sheetId="1" r:id="rId1"/></sheets></workbook>';
const relationships = '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>';

test('CSV reader counts quoted multiline records without reproducing data rows', () => {
  const result = inspectDelimited('rule_id,description,enabled\r\nalpha,"A comma, and\na second line",true\r\nbeta,"Escaped ""quote""",false\r\n', '.csv');
  assert.equal(result.recordCount, 3);
  assert.equal(result.minColumns, 3);
  assert.equal(result.maxColumns, 3);
  assert.deepEqual(result.headers, ['rule_id', 'description', 'enabled']);
  assert.equal(result.malformed, false);
  assert.ok(!JSON.stringify(result).includes('a second line'));
});

test('malformed CSV is reported and tab-separated input retains its delimiter', () => {
  assert.equal(inspectDelimited('id,label\n1,"unterminated', '.csv').malformed, true);
  const result = inspectDelimited('rule_id\tenabled\nalpha\ttrue\n', '.tsv');
  assert.equal(result.delimiter, 'tab');
  assert.equal(result.recordCount, 2);
  assert.deepEqual(result.headers, ['rule_id', 'enabled']);
});

test('workbook reader exposes sheet and cell structure while omitting values and formulas', () => {
  const bytes = workbookZip({
    'xl/workbook.xml': manifest,
    'xl/_rels/workbook.xml.rels': relationships,
    'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>example-value</t></is></c><c r="B1"><f>SUM(10,20)</f><v>30</v></c></row></sheetData></worksheet>',
  });
  const result = inspectWorkbook(bytes);
  assert.equal(result.sheets.length, 1);
  assert.equal(result.sheets[0].name, 'Example rules');
  assert.equal(result.sheets[0].available, true);
  assert.equal(result.sheets[0].cellCount, 2);
  assert.equal(result.sheets[0].formulaCount, 1);
  assert.deepEqual(result.sheets[0].cells.map((cell) => cell.address), ['A1', 'B1']);
  assert.ok(!JSON.stringify(result).includes('SUM(10,20)'));
  assert.ok(!JSON.stringify(result).includes('example-value'));
});

test('workbook XML entities and invalid archives fail into explicit coverage limitations', () => {
  const entities = workbookZip({
    'xl/workbook.xml': '<!DOCTYPE workbook [<!ENTITY external SYSTEM "file:///unavailable">]>' + manifest,
    'xl/_rels/workbook.xml.rels': relationships,
  });
  const blocked = inspectWorkbook(entities);
  assert.deepEqual(blocked.sheets, []);
  assert.match(blocked.limitations.join(' '), /not inspected|entit/i);
  const truncated = inspectWorkbook(Buffer.from('not a ZIP file'));
  assert.deepEqual(truncated.sheets, []);
  assert.match(truncated.limitations.join(' '), /not inspected|truncated/i);
});

test('external workbook relationships are not fetched or accepted as local sheet contents', () => {
  const result = inspectWorkbook(workbookZip({
    'xl/workbook.xml': manifest,
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="https://example.invalid/sheet.xml" TargetMode="External"/></Relationships>',
    'xl/worksheets/sheet1.xml': '<worksheet><sheetData/></worksheet>',
  }));
  assert.equal(result.sheets[0].available, false);
});
