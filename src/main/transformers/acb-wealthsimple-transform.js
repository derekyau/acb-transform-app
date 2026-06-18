const fs = require('node:fs/promises');
const {
  buildHeaderMap,
  foreignCurrencyFlag,
  formatDate,
  getCell,
  isBlankRow,
  normalizeHeader,
  outputHeaders,
  readRows,
  toCsv,
} = require('./transformer-utils.js');

const requiredHeaders = [
  'transaction_date',
  'activity_type',
  'activity_sub_type',
  'symbol',
  'name',
  'currency',
  'quantity',
  'commission',
  'net_cash_amount',
];

function isTradeRow(row, headerMap) {
  return getCell(row, headerMap, 'activity_type') === 'Trade';
}

async function transform({ inputPath, outputPath }) {
  const rows = readRows(inputPath);
  const [headers, ...dataRows] = rows;

  if (!headers || isBlankRow(headers)) {
    throw new Error('The input file does not contain a header row.');
  }

  const headerMap = buildHeaderMap(headers);
  const missingHeaders = requiredHeaders.filter((header) => !headerMap.has(normalizeHeader(header)));

  if (missingHeaders.length > 0) {
    throw new Error(`The input file is missing required Wealthsimple columns: ${missingHeaders.join(', ')}.`);
  }

  const transformedRows = dataRows
    .filter((row) => !isBlankRow(row))
    .filter((row) => isTradeRow(row, headerMap))
    .map((row) => {
      const currency = getCell(row, headerMap, 'currency');
      const isForeignCurrency = foreignCurrencyFlag(currency);

      return [
        getCell(row, headerMap, 'symbol'),
        formatDate(getCell(row, headerMap, 'transaction_date')),
        getCell(row, headerMap, 'activity_sub_type'),
        getCell(row, headerMap, 'net_cash_amount'),
        getCell(row, headerMap, 'quantity'),
        getCell(row, headerMap, 'commission'),
        getCell(row, headerMap, 'name'),
        currency,
        isForeignCurrency,
        isForeignCurrency,
      ];
    });

  if (transformedRows.length === 0) {
    throw new Error('The input file does not contain any Wealthsimple trade rows.');
  }

  await fs.writeFile(outputPath, toCsv([outputHeaders, ...transformedRows]), 'utf8');
}

module.exports = { transform };
