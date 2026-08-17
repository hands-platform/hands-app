type CsvCell = string | number | boolean | null | undefined;

export type CsvRow = Record<string, CsvCell>;

export function buildCsvContent(rows: CsvRow[], fallbackHeaders: string[] = []) {
  const headers = uniqueHeaders(rows, fallbackHeaders);
  const lines = [
    buildCsvHeader(headers),
    ...rows.map((row) => buildCsvRowContent(row, headers)),
  ];

  return lines.join('\r\n');
}

export function buildCsvHeader(headers: readonly string[]) {
  return headers.map(csvEscape).join(',');
}

export function buildCsvRowContent(row: CsvRow, headers: readonly string[]) {
  return headers.map((header) => csvEscape(row[header])).join(',');
}

export function buildCsvDataHref(rows: CsvRow[], fallbackHeaders: string[] = []) {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(buildCsvContent(rows, fallbackHeaders))}`;
}

function uniqueHeaders(rows: CsvRow[], fallbackHeaders: string[]) {
  const headers = new Set(fallbackHeaders);
  for (const row of rows) {
    Object.keys(row).forEach((key) => headers.add(key));
  }
  return [...headers];
}

function csvEscape(value: CsvCell) {
  const raw = value == null ? '' : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}
