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
  'Symbol',
  'TradeDate',
  'Buy/Sell',
  'Proceeds',
  'Quantity',
  'IBCommission',
  'Description',
  'CurrencyPrimary',
];

function isTradeRow(row, headerMap) {
  return ['BUY', 'SELL'].includes(String(getCell(row, headerMap, 'Buy/Sell')).trim().toUpperCase());
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
    throw new Error(`The input file is missing required IBKR columns: ${missingHeaders.join(', ')}.`);
  }

  const transformedRows = dataRows
    .filter((row) => !isBlankRow(row))
    .filter((row) => isTradeRow(row, headerMap))
    .map((row) => {
      const isForeignCurrency = foreignCurrencyFlag(getCell(row, headerMap, 'CurrencyPrimary'));

      return [
        getCell(row, headerMap, 'Symbol'),
        formatDate(getCell(row, headerMap, 'TradeDate')),
        getCell(row, headerMap, 'Buy/Sell'),
        getCell(row, headerMap, 'Proceeds'),
        getCell(row, headerMap, 'Quantity'),
        getCell(row, headerMap, 'IBCommission'),
        getCell(row, headerMap, 'Description'),
        getCell(row, headerMap, 'CurrencyPrimary'),
        isForeignCurrency,
        isForeignCurrency,
      ];
    });

  if (transformedRows.length === 0) {
    throw new Error('The input file does not contain any IBKR trade rows.');
  }

  await fs.writeFile(outputPath, toCsv([outputHeaders, ...transformedRows]), 'utf8');
}

module.exports = { transform };
