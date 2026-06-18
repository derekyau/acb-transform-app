const XLSX = require('xlsx');

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

function normalizeHeader(header) {
  return String(header ?? '')
    .trim()
    .toLowerCase();
}

function buildHeaderMap(headers) {
  const headerMap = new Map();

  headers.forEach((header, index) => {
    const normalizedHeader = normalizeHeader(header);

    if (normalizedHeader) {
      headerMap.set(normalizedHeader, index);
    }
  });

  return headerMap;
}

function getCell(row, headerMap, header) {
  const index = headerMap.get(normalizeHeader(header));
  return index === undefined ? '' : row[index];
}

function stringifyCell(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim();
}

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function formatDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${padDatePart(value.getDate())}/${padDatePart(value.getMonth() + 1)}/${value.getFullYear()}`;
  }

  if (typeof value === 'number') {
    const parsedDate = XLSX.SSF.parse_date_code(value);

    if (parsedDate) {
      return `${padDatePart(parsedDate.d)}/${padDatePart(parsedDate.m)}/${parsedDate.y}`;
    }
  }

  const text = stringifyCell(value);
  const isoDateMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (isoDateMatch) {
    const [, year, month, day] = isoDateMatch;
    return `${padDatePart(day)}/${padDatePart(month)}/${year}`;
  }

  return text;
}

function isBlankRow(row) {
  return row.every((cell) => stringifyCell(cell) === '');
}

function escapeCsvCell(value) {
  const text = stringifyCell(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function toCsv(rows) {
  return `${rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')}\n`;
}

function readRows(inputPath) {
  const workbook = XLSX.readFile(inputPath, {
    cellDates: true,
    raw: true,
  });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error('The input workbook does not contain any sheets.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    defval: '',
    raw: true,
  });
}

function foreignCurrencyFlag(currency) {
  return stringifyCell(currency).toUpperCase() === 'CAD' ? 'N' : 'Y';
}

module.exports = {
  buildHeaderMap,
  foreignCurrencyFlag,
  formatDate,
  getCell,
  isBlankRow,
  normalizeHeader,
  outputHeaders,
  readRows,
  stringifyCell,
  toCsv,
};
