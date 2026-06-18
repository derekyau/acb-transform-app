import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { transform } = require('./acb-wealthsimple-transform.js');

const headers = [
  'transaction_date',
  'settlement_date',
  'account_id',
  'account_type',
  'activity_type',
  'activity_sub_type',
  'direction',
  'symbol',
  'name',
  'currency',
  'quantity',
  'unit_price',
  'commission',
  'net_cash_amount',
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

const tempDirs = [];

async function createTempDir() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'acb-wealthsimple-transform-'));
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

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
});

describe('Wealthsimple transformer', () => {
  it('transforms only Wealthsimple trade rows into the ACB CSV layout', async () => {
    const tempDir = await createTempDir();
    const inputPath = path.join(tempDir, 'wealthsimple-export.csv');
    const outputPath = path.join(tempDir, 'output.csv');

    await writeCsvInput(inputPath, [
      headers,
      [
        '2025-12-17',
        '',
        'HQ5TPLWN9CAD',
        'LIRA',
        'Dividend',
        '',
        '',
        'TOPW',
        'Roundhill ETF Trust - Top Weeklypay ETF',
        'USD',
        '268.27',
        '',
        '',
        '268.27',
      ],
      [
        '2025-12-18',
        '2025-12-18',
        'HQ5TPLWN9CAD',
        'LIRA',
        'Trade',
        'BUY',
        'LONG',
        'TOPW',
        'Roundhill ETF Trust - Top Weeklypay ETF',
        'USD',
        '6.3056',
        '42.5443',
        '0',
        '-268.27',
      ],
      [
        '2026-02-06',
        '',
        'HQ5TPLWN9CAD',
        'LIRA',
        'Interest',
        '',
        '',
        '',
        'Interest',
        'CAD',
        '',
        '',
        '',
        '1.23',
      ],
      [
        '2026-03-17',
        '2026-03-17',
        'HQ5TPLWN9CAD',
        'LIRA',
        'Trade',
        'SELL',
        'LONG',
        'AAPL',
        'Apple Inc.',
        'USD',
        '-2',
        '195',
        '0',
        '390.00',
      ],
      [
        '2026-06-09',
        '2026-06-10',
        'HQ5TPLWN9CAD',
        'TFSA',
        'Trade',
        'BUY',
        'LONG',
        'XEQT',
        'iShares Core Equity ETF Portfolio',
        'CAD',
        '10',
        '32.45',
        '0',
        '-324.50',
      ],
    ]);

    await transform({ inputPath, outputPath });

    await expect(readOutputRows(outputPath)).resolves.toEqual([
      outputHeaders,
      [
        'TOPW',
        '18/12/2025',
        'BUY',
        '-268.27',
        '6.3056',
        '0',
        'Roundhill ETF Trust - Top Weeklypay ETF',
        'USD',
        'Y',
        'Y',
      ],
      ['AAPL', '17/03/2026', 'SELL', '390.00', '-2', '0', 'Apple Inc.', 'USD', 'Y', 'Y'],
      [
        'XEQT',
        '09/06/2026',
        'BUY',
        '-324.50',
        '10',
        '0',
        'iShares Core Equity ETF Portfolio',
        'CAD',
        'N',
        'N',
      ],
    ]);
  });

  it('rejects files missing required Wealthsimple headers', async () => {
    const tempDir = await createTempDir();
    const inputPath = path.join(tempDir, 'wealthsimple-export.csv');
    const outputPath = path.join(tempDir, 'output.csv');
    await writeCsvInput(inputPath, [headers.filter((header) => header !== 'net_cash_amount'), []]);

    await expect(transform({ inputPath, outputPath })).rejects.toThrow(
      'missing required Wealthsimple columns: net_cash_amount',
    );
  });

  it('rejects files with no Wealthsimple trade rows', async () => {
    const tempDir = await createTempDir();
    const inputPath = path.join(tempDir, 'wealthsimple-export.csv');
    const outputPath = path.join(tempDir, 'output.csv');
    await writeCsvInput(inputPath, [
      headers,
      [
        '2025-12-17',
        '',
        'HQ5TPLWN9CAD',
        'LIRA',
        'Dividend',
        '',
        '',
        'TOPW',
        'Roundhill ETF Trust - Top Weeklypay ETF',
        'USD',
        '268.27',
        '',
        '',
        '268.27',
      ],
    ]);

    await expect(transform({ inputPath, outputPath })).rejects.toThrow(
      'The input file does not contain any Wealthsimple trade rows.',
    );
  });
});
