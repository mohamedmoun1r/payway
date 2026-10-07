/**
 * Utility for generating CSV files with UTF-8 BOM encoding and formula injection protection.
 */

export interface CsvColumn<T> {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
}

/**
 * Sanitizes a cell value to prevent CSV formula injection (DDE attacks) in spreadsheet software.
 * If the value starts with dangerous characters (=, +, -, @, \t, \r) or has leading whitespace
 * before a formula character, prepends a single quote.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const raw = String(value);
  if (raw.length === 0) {
    return '';
  }

  // Dangerous leading characters that trigger formula execution in Excel/Calc
  const dangerousChars = ['=', '+', '-', '@', '\t', '\r'];
  const trimmed = raw.trimStart();

  const startsWithDangerous =
    dangerousChars.some((char) => raw.startsWith(char)) ||
    dangerousChars.some((char) => trimmed.startsWith(char));

  const sanitized = startsWithDangerous ? `'${raw}` : raw;

  // Escape double quotes by doubling them
  return `"${sanitized.replace(/"/g, '""')}"`;
}

/**
 * Serializes an array of records into a CSV string with UTF-8 BOM for Arabic character preservation.
 */
export function generateCsv<T>(data: T[], columns: CsvColumn<T>[]): string {
  // UTF-8 Byte Order Mark (BOM) to force Excel to read Arabic text correctly
  const BOM = '\uFEFF';

  const headerRow = columns.map((col) => sanitizeCsvCell(col.header)).join(',');

  const dataRows = data.map((row) =>
    columns.map((col) => sanitizeCsvCell(col.accessor(row))).join(',')
  );

  return [BOM + headerRow, ...dataRows].join('\r\n');
}
