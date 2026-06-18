import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';
import XLSX from 'xlsx';

const require = createRequire(import.meta.url);
const { transform } = require('./acb-qt-transform.js');

const headers = [
  'Transaction Date',
  'Settlement Date',
  'Action',
  'Symbol',
  'Description',
  'Quantity',
  'Price',
  'Gross Amount',
  'Commission',
  'Net Amount',
  'Currency',
  'Account #',
  'Activity Type',
  'Account Type',
];

const outputHeaders = [
  'Security',
  'Date',
  'Transaction Type',
  'Amount',
  'Shares',
  'Commission',
  'Memo',
  'Exchange Rate / Currency Code',
  'Price in Foreign Currency?',
  'Commission in Foreign Currency?',
];

const sampleRows = [
  [
    '2026-06-09 12:00:00 AM',
    '2026-06-10 12:00:00 AM',
    'Sell',
    'ZEB.TO',
    'BMO EQUAL WEIGHT BANKS INDX ETF CAD UNITS WE ACTED AS AGENT',
    '-13.00000',
    '70.38000000',
    '914.94',
    '0.00',
    '914.94',
    'CAD',
    '26482108',
    'Trades',
    'Individual margin',
  ],
  [
    '2026-05-14 12:00:00 AM',
    '2026-05-15 12:00:00 AM',
    'Sell',
    'TQQQ',
    'PROSHARES TRUST ULTRAPRO QQQ WE ACTED AS AGENT AVG PRICE - ASK US FOR DETAILS',
    '-67.00000',
    '78.82000000',
    '5280.94',
    '-0.31',
    '5280.63',
    'USD',
    '26482108',
    'Trades',
    'Individual margin',
  ],
];

const tempDirs = [];

async function createTempDir() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'acb-qt-transform-'));
  tempDirs.push(tempDir);
  return tempDir;
}

function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];
    const nextCharacter = csvText[index + 1];

    if (inQuotes) {
      if (character === '"' && nextCharacter === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      inQuotes = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (character !== '\r') {
      cell += character;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

async function readOutputRows(outputPath) {
  return parseCsv(await readFile(outputPath, 'utf8'));
}

async function writeCsvInput(inputPath, rows) {
  const csvText = rows
    .map((row) =>
      row
        .map((cell) => {
          const text = String(cell);
          return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
        })
        .join(','),
    )
    .join('\n');

  await writeFile(inputPath, `${csvText}\n`, 'utf8');
}

function writeXlsxInput(inputPath, rows) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Activities');
  XLSX.writeFile(workbook, inputPath);
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
});

describe('QT transformer', () => {
  it('transforms a Questrade XLSX export into the ACB CSV layout', async () => {
    const tempDir = await createTempDir();
    const inputPath = path.join(tempDir, 'activities.xlsx');
    const outputPath = path.join(tempDir, 'output.csv');
    writeXlsxInput(inputPath, [headers, ...sampleRows]);

    await transform({ inputPath, outputPath });

    await expect(readOutputRows(outputPath)).resolves.toEqual([
      outputHeaders,
      [
        'ZEB.TO',
        '09/06/2026',
        'Sell',
        '914.94',
        '-13.00000',
        '0.00',
        'BMO EQUAL WEIGHT BANKS INDX ETF CAD UNITS WE ACTED AS AGENT',
        'CAD',
        'N',
        'N',
      ],
      [
        'TQQQ',
        '14/05/2026',
        'Sell',
        '5280.94',
        '-67.00000',
        '-0.31',
        'PROSHARES TRUST ULTRAPRO QQQ WE ACTED AS AGENT AVG PRICE - ASK US FOR DETAILS',
        'USD',
        'Y',
        'Y',
      ],
    ]);
  });

  it('transforms a Questrade CSV export with the same mapping', async () => {
    const tempDir = await createTempDir();
    const inputPath = path.join(tempDir, 'activities.csv');
    const outputPath = path.join(tempDir, 'output.csv');
    await writeCsvInput(inputPath, [headers, sampleRows[0]]);

    await transform({ inputPath, outputPath });

    await expect(readOutputRows(outputPath)).resolves.toEqual([
      outputHeaders,
      [
        'ZEB.TO',
        '09/06/2026',
        'Sell',
        '914.94',
        '-13.00000',
        '0.00',
        'BMO EQUAL WEIGHT BANKS INDX ETF CAD UNITS WE ACTED AS AGENT',
        'CAD',
        'N',
        'N',
      ],
    ]);
  });

  it('transforms a Questrade XLS export', async () => {
    const tempDir = await createTempDir();
    const inputPath = path.join(tempDir, 'activities.xls');
    const outputPath = path.join(tempDir, 'output.csv');
    writeXlsxInput(inputPath, [headers, sampleRows[1]]);

    await transform({ inputPath, outputPath });

    await expect(readOutputRows(outputPath)).resolves.toEqual([
      outputHeaders,
      [
        'TQQQ',
        '14/05/2026',
        'Sell',
        '5280.94',
        '-67.00000',
        '-0.31',
        'PROSHARES TRUST ULTRAPRO QQQ WE ACTED AS AGENT AVG PRICE - ASK US FOR DETAILS',
        'USD',
        'Y',
        'Y',
      ],
    ]);
  });

  it('transforms only Questrade trade rows', async () => {
    const tempDir = await createTempDir();
    const inputPath = path.join(tempDir, 'activities.csv');
    const outputPath = path.join(tempDir, 'output.csv');
    await writeCsvInput(inputPath, [
      headers,
      [
        '2026-06-01 12:00:00 AM',
        '2026-06-01 12:00:00 AM',
        'Dividend',
        'ZEB.TO',
        'Dividend payment',
        '',
        '',
        '12.34',
        '0.00',
        '12.34',
        'CAD',
        '26482108',
        'Dividends',
        'Individual margin',
      ],
      sampleRows[0],
      [
        '2026-06-02 12:00:00 AM',
        '2026-06-02 12:00:00 AM',
        'Deposit',
        '',
        'Cash deposit',
        '',
        '',
        '100.00',
        '0.00',
        '100.00',
        'CAD',
        '26482108',
        'Deposits',
        'Individual margin',
      ],
    ]);

    await transform({ inputPath, outputPath });

    await expect(readOutputRows(outputPath)).resolves.toEqual([
      outputHeaders,
      [
        'ZEB.TO',
        '09/06/2026',
        'Sell',
        '914.94',
        '-13.00000',
        '0.00',
        'BMO EQUAL WEIGHT BANKS INDX ETF CAD UNITS WE ACTED AS AGENT',
        'CAD',
        'N',
        'N',
      ],
    ]);
  });

  it('rejects files missing required Questrade headers', async () => {
    const tempDir = await createTempDir();
    const inputPath = path.join(tempDir, 'activities.csv');
    const outputPath = path.join(tempDir, 'output.csv');
    await writeCsvInput(inputPath, [headers.filter((header) => header !== 'Gross Amount'), []]);

    await expect(transform({ inputPath, outputPath })).rejects.toThrow(
      'missing required Questrade columns: Gross Amount',
    );
  });

  it('rejects files missing the Questrade activity type header', async () => {
    const tempDir = await createTempDir();
    const inputPath = path.join(tempDir, 'activities.csv');
    const outputPath = path.join(tempDir, 'output.csv');
    await writeCsvInput(inputPath, [headers.filter((header) => header !== 'Activity Type'), []]);

    await expect(transform({ inputPath, outputPath })).rejects.toThrow(
      'missing required Questrade columns: Activity Type',
    );
  });

  it('rejects files with no Questrade trade rows', async () => {
    const tempDir = await createTempDir();
    const inputPath = path.join(tempDir, 'activities.csv');
    const outputPath = path.join(tempDir, 'output.csv');
    await writeCsvInput(inputPath, [
      headers,
      [
        '2026-06-01 12:00:00 AM',
        '2026-06-01 12:00:00 AM',
        'Dividend',
        'ZEB.TO',
        'Dividend payment',
        '',
        '',
        '12.34',
        '0.00',
        '12.34',
        'CAD',
        '26482108',
        'Dividends',
        'Individual margin',
      ],
    ]);

    await expect(transform({ inputPath, outputPath })).rejects.toThrow(
      'The input file does not contain any Questrade trade rows.',
    );
  });
});
