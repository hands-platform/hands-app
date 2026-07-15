import type {
  AdminCompanyBankTransactionBatchInputRow,
  AdminCompanyBankTransactionBatchPreview,
} from './admin-api';

const MAX_CSV_BYTES = 512 * 1024;
const MAX_CSV_ROWS = 50;

export type BankStatementCsvPreset = 'GENERIC' | 'VCB' | 'MOMO' | 'VNPAY';

type BankStatementCsvDefaults = {
  bankAccountId: string;
  type: 'INFLOW' | 'OUTFLOW';
};

const COLUMN_ALIASES = {
  amount: ['amount', 'transactionamount'],
  counterpartyName: [
    'counterparty',
    'counterpartyname',
    'sender',
    'receiver',
    'partnername',
    'customername',
    'merchantname',
    'bankcode',
  ],
  currency: ['currency', 'ccy'],
  description: ['description', 'memo', 'narrative', 'content', 'note', 'orderinfo'],
  occurredAt: [
    'occurredat',
    'transactiondate',
    'transactiontime',
    'transactiondatetime',
    'paymenttime',
    'datetime',
    'date',
  ],
  sourceKey: ['sourcekey', 'settlementid', 'banktransactionid'],
  transferRef: [
    'transferref',
    'reference',
    'ref',
    'transactionid',
    'transactionno',
    'transactionnumber',
    'orderid',
  ],
  valueDate: ['valuedate'],
} as const;

const PRESET_TEMPLATES: Record<BankStatementCsvPreset, { headers: string[]; example: string[] }> = {
  GENERIC: {
    headers: [
      'occurredAt',
      'amount',
      'transferRef',
      'counterpartyName',
      'description',
      'valueDate',
      'currency',
      'sourceKey',
    ],
    example: [
      '2026-07-14T08:00:00+07:00',
      '1250000',
      'BANK-REF-001',
      'Example Counterparty',
      'Example bank statement row',
      '2026-07-14',
      'VND',
      '',
    ],
  },
  VCB: {
    headers: ['transaction_date', 'amount', 'reference', 'counterparty', 'description', 'value_date', 'currency'],
    example: [
      '2026-07-14T08:00:00+07:00',
      '1250000',
      'VCB-REF-001',
      'Example Counterparty',
      'Example VCB statement row',
      '2026-07-14',
      'VND',
    ],
  },
  MOMO: {
    headers: ['transaction_time', 'amount', 'transaction_id', 'partner_name', 'description', 'currency'],
    example: [
      '2026-07-14T08:00:00+07:00',
      '1250000',
      'MOMO-TXN-001',
      'Example Partner',
      'Example MoMo settlement row',
      'VND',
    ],
  },
  VNPAY: {
    headers: ['transaction_time', 'amount', 'transaction_no', 'bank_code', 'order_info', 'currency'],
    example: [
      '2026-07-14T08:00:00+07:00',
      '1250000',
      'VNPAY-TXN-001',
      'VCB',
      'Example VNPAY settlement row',
      'VND',
    ],
  },
};

export function parseBankStatementCsv(
  csv: string,
  defaults: BankStatementCsvDefaults,
  preset: BankStatementCsvPreset = 'GENERIC',
): AdminCompanyBankTransactionBatchInputRow[] {
  if (new TextEncoder().encode(csv).byteLength > MAX_CSV_BYTES) {
    throw new Error('CSV file must be 512 KB or smaller.');
  }
  const records = parseCsvRecords(csv.replace(/^\uFEFF/u, ''));
  if (records.length < 2) {
    throw new Error('CSV must include a header and at least one transaction row.');
  }
  const headers = records[0].map(normalizeHeader);
  const columnIndexes = resolveColumnIndexes(headers);
  if (columnIndexes.amount === -1 || columnIndexes.occurredAt === -1) {
    throw new Error(`${bankStatementCsvPresetLabel(preset)} CSV requires amount and transaction date columns.`);
  }
  const dataRows = records.slice(1).filter((record) => record.some((value) => value.trim()));
  if (dataRows.length > MAX_CSV_ROWS) {
    throw new Error(`CSV supports up to ${MAX_CSV_ROWS} transaction rows per review.`);
  }

  return dataRows.map((record, index) => ({
    amount: readColumn(record, columnIndexes.amount),
    bankAccountId: defaults.bankAccountId,
    counterpartyName: readColumn(record, columnIndexes.counterpartyName),
    currency: readColumn(record, columnIndexes.currency),
    description: readColumn(record, columnIndexes.description),
    occurredAt: readColumn(record, columnIndexes.occurredAt),
    rowNumber: index + 2,
    sourceKey: readColumn(record, columnIndexes.sourceKey),
    transferRef: readColumn(record, columnIndexes.transferRef),
    type: defaults.type,
    valueDate: readColumn(record, columnIndexes.valueDate),
  }));
}

export function bankStatementCsvTemplate(preset: BankStatementCsvPreset) {
  const template = PRESET_TEMPLATES[preset];
  return `${template.headers.map(escapeCsvField).join(',')}\r\n${template.example.map(escapeCsvField).join(',')}\r\n`;
}

export function bankStatementCsvPresetLabel(preset: BankStatementCsvPreset) {
  if (preset === 'VCB') return 'VCB mapping';
  if (preset === 'MOMO') return 'MoMo settlement mapping';
  if (preset === 'VNPAY') return 'VNPAY settlement mapping';
  return 'HANDS Generic';
}

export function bankStatementCsvIssueReport(rows: AdminCompanyBankTransactionBatchPreview['rows']) {
  const issueRows = rows.filter((row) => row.classification !== 'NEW');
  const headers = [
    'csvRow',
    'classification',
    'amount',
    'occurredAt',
    'valueDate',
    'transferRef',
    'counterpartyName',
    'issues',
    'candidateIds',
    'batchCandidateRows',
  ];
  return csvRecords([
    headers,
    ...issueRows.map((row) => [
      String(row.rowNumber),
      row.classification,
      row.raw.amount,
      row.raw.occurredAt,
      row.raw.valueDate,
      row.raw.transferRef,
      row.raw.counterpartyName,
      bankStatementRowIssues(row),
      row.candidates.map((candidate) => candidate.id).join(' '),
      row.batchCandidateRowNumbers.join(' '),
    ]),
  ]);
}

export function bankStatementCsvRetryFile(rows: AdminCompanyBankTransactionBatchInputRow[]) {
  const headers = [
    'occurredAt',
    'amount',
    'transferRef',
    'counterpartyName',
    'description',
    'valueDate',
    'currency',
    'sourceKey',
  ];
  return csvRecords([
    headers,
    ...rows.map((row) => [
      row.occurredAt,
      row.amount,
      row.transferRef ?? '',
      row.counterpartyName ?? '',
      row.description ?? '',
      row.valueDate ?? '',
      row.currency ?? '',
      row.sourceKey ?? '',
    ]),
  ]);
}

function parseCsvRecords(csv: string) {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ',') {
      record.push(field);
      field = '';
    } else if (character === '\n') {
      record.push(field.replace(/\r$/u, ''));
      records.push(record);
      record = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (quoted) {
    throw new Error('CSV contains an unterminated quoted field.');
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field.replace(/\r$/u, ''));
    records.push(record);
  }
  return records;
}

function resolveColumnIndexes(headers: string[]) {
  return Object.fromEntries(
    Object.entries(COLUMN_ALIASES).map(([key, aliases]) => [
      key,
      headers.findIndex((header) => (aliases as readonly string[]).includes(header)),
    ]),
  ) as Record<keyof typeof COLUMN_ALIASES, number>;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/gu, '');
}

function readColumn(record: string[], index: number) {
  return index < 0 ? '' : (record[index] ?? '').trim();
}

function escapeCsvField(value: string) {
  return /[",\r\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function csvRecords(records: string[][]) {
  return `${records.map((record) => record.map(escapeCsvField).join(',')).join('\r\n')}\r\n`;
}

function bankStatementRowIssues(row: AdminCompanyBankTransactionBatchPreview['rows'][number]) {
  if (row.errors.length > 0) return row.errors.join('; ');
  if (row.classification === 'EXACT_DUPLICATE') return 'Exact duplicate; do not import again';
  if (row.classification === 'POTENTIAL_DUPLICATE') return 'Potential duplicate; review linked evidence';
  return '';
}
