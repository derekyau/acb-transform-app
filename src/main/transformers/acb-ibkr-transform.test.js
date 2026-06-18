import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';
import XLSX from 'xlsx';

const require = createRequire(import.meta.url);
const { transform } = require('./acb-ibkr-transform.js');

const headers = [
  'Symbol',
  'TradeDate',
  'Buy/Sell',
  'Proceeds',
  'Quantity',
  'IBCommission',
  'Description',
  'CurrencyPrimary',
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
  ['DRAM', '27/05/2026', 'BUY', '-12088', '200', '-1.0006', 'ROUNDHILL MEMORY ETF', 'USD'],
  ['USD.CAD', '08/05/2026', 'SELL', '41999.9988431', '-30697.49', '-2.733', 'USD.CAD', 'CAD'],
];

const tempDirs = [];

async function createTempDir() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'acb-ibkr-transform-'));
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
  XLSX.utils.book_append_sheet(workbook, sheet, 'Trades');
  XLSX.writeFile(workbook, inputPath);
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
});

describe('IBKR transformer', () => {
  it('transforms an IBKR CSV export into the ACB CSV layout', async () => {
    const tempDir = await createTempDir();
    const inputPath = path.join(tempDir, 'ibkr-export.csv');
    const outputPath = path.join(tempDir, 'output.csv');
    await writeCsvInput(inputPath, [headers, ...sampleRows]);

    await transform({ inputPath, outputPath });

    await expect(readOutputRows(outputPath)).resolves.toEqual([
      outputHeaders,
      ['DRAM', '27/05/2026', 'BUY', '-12088', '200', '-1.0006', 'ROUNDHILL MEMORY ETF', 'USD', 'Y', 'Y'],
      ['USD.CAD', '08/05/2026', 'SELL', '41999.9988431', '-30697.49', '-2.733', 'USD.CAD', 'CAD', 'N', 'N'],
    ]);
  });

  it('transforms an IBKR XLSX export with the same mapping', async () => {
    const tempDir = await createTempDir();
    const inputPath = path.join(tempDir, 'ibkr-export.xlsx');
    const outputPath = path.join(tempDir, 'output.csv');
    writeXlsxInput(inputPath, [headers, sampleRows[0]]);

    await transform({ inputPath, outputPath });

    await expect(readOutputRows(outputPath)).resolves.toEqual([
      outputHeaders,
      ['DRAM', '27/05/2026', 'BUY', '-12088', '200', '-1.0006', 'ROUNDHILL MEMORY ETF', 'USD', 'Y', 'Y'],
    ]);
  });

  it('transforms an IBKR XLS export', async () => {
    const tempDir = await createTempDir();
    const inputPath = path.join(tempDir, 'ibkr-export.xls');
    const outputPath = path.join(tempDir, 'output.csv');
    writeXlsxInput(inputPath, [headers, sampleRows[1]]);

    await transform({ inputPath, outputPath });

    await expect(readOutputRows(outputPath)).resolves.toEqual([
      outputHeaders,
      ['USD.CAD', '08/05/2026', 'SELL', '41999.9988431', '-30697.49', '-2.733', 'USD.CAD', 'CAD', 'N', 'N'],
    ]);
  });

  it('transforms only IBKR buy and sell rows', async () => {
    const tempDir = await createTempDir();
    const inputPath = path.join(tempDir, 'ibkr-export.csv');
    const outputPath = path.join(tempDir, 'output.csv');
    await writeCsvInput(inputPath, [
      headers,
      ['CASH', '03/05/2026', '', '1000', '', '', 'Cash deposit', 'CAD'],
      sampleRows[0],
      ['BOND', '04/05/2026', 'INTEREST', '12.34', '', '', 'Interest payment', 'CAD'],
      ['AAPL', '05/05/2026', ' sell ', '1950', '-10', '-1', 'APPLE INC', 'USD'],
    ]);

    await transform({ inputPath, outputPath });

    await expect(readOutputRows(outputPath)).resolves.toEqual([
      outputHeaders,
      ['DRAM', '27/05/2026', 'BUY', '-12088', '200', '-1.0006', 'ROUNDHILL MEMORY ETF', 'USD', 'Y', 'Y'],
      ['AAPL', '05/05/2026', 'sell', '1950', '-10', '-1', 'APPLE INC', 'USD', 'Y', 'Y'],
    ]);
  });

  it('rejects files missing required IBKR headers', async () => {
    const tempDir = await createTempDir();
    const inputPath = path.join(tempDir, 'ibkr-export.csv');
    const outputPath = path.join(tempDir, 'output.csv');
    await writeCsvInput(inputPath, [headers.filter((header) => header !== 'Proceeds'), []]);

    await expect(transform({ inputPath, outputPath })).rejects.toThrow(
      'missing required IBKR columns: Proceeds',
    );
  });

  it('rejects files with no IBKR trade rows', async () => {
    const tempDir = await createTempDir();
    const inputPath = path.join(tempDir, 'ibkr-export.csv');
    const outputPath = path.join(tempDir, 'output.csv');
    await writeCsvInput(inputPath, [
      headers,
      ['CASH', '03/05/2026', '', '1000', '', '', 'Cash deposit', 'CAD'],
      ['BOND', '04/05/2026', 'INTEREST', '12.34', '', '', 'Interest payment', 'CAD'],
    ]);

    await expect(transform({ inputPath, outputPath })).rejects.toThrow(
      'The input file does not contain any IBKR trade rows.',
    );
  });
});
