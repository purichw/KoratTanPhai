// @vitest-environment node
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const excelRequire = createRequire(require.resolve('@protobi/exceljs'));
const Excel = excelRequire('@protobi/exceljs');

it('reads Thai text and categorical zero values through the upgraded streaming XLSX reader', async () => {
  const workbook = new Excel.Workbook();
  const sheet = workbook.addWorksheet('พยากรณ์');
  sheet.addRows([['ตำบล', 'T+1', 'T+2'], ['ในเมือง', 0, 2]]);
  const bytes = await workbook.xlsx.writeBuffer();
  const reader = new Excel.stream.xlsx.WorkbookReader(Readable.from([bytes]), {
    worksheets: 'emit', sharedStrings: 'cache', styles: 'cache', hyperlinks: 'ignore',
  });
  const rows: unknown[] = [];
  for await (const worksheet of reader) for await (const row of worksheet) rows.push(row.values.slice(1));
  expect(rows).toEqual([['ตำบล', 'T+1', 'T+2'], ['ในเมือง', 0, 2]]);
});

it('keeps the archiver glob and exclusion APIs compatible with patched matching dependencies', async () => {
  const archiver = excelRequire('archiver');
  const archiveRequire = createRequire(excelRequire.resolve('archiver'));
  const utils = archiveRequire('archiver-utils');
  const expected = ['src/theme-tokens.css'];
  expect(utils.file.expand({ cwd: process.cwd() }, ['src/theme*.css', '!src/styles.css'])).toEqual(expected);
  const archive = archiver('zip');
  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);
  });
  archive.glob('src/theme*.css', { cwd: process.cwd(), ignore: ['src/styles.css'] });
  await archive.finalize();
  const directory = await excelRequire('unzipper').Open.buffer(await completed);
  expect(directory.files.map((file: {path:string}) => file.path)).toEqual(expected);
  expect(await directory.files[0].buffer()).toEqual(readFileSync(expected[0]));
});
