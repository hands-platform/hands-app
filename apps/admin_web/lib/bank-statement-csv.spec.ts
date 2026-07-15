import {
  bankStatementCsvIssueReport,
  bankStatementCsvRetryFile,
  bankStatementCsvTemplate,
  parseBankStatementCsv,
} from './bank-statement-csv';

describe('parseBankStatementCsv', () => {
  it('parses quoted bank statement fields and applies reviewed account defaults', () => {
    const rows = parseBankStatementCsv(
      [
        'date,amount,reference,counterparty,description',
        '2026-07-14T08:00:00.000Z,"1,250,000",VCB-100,"Demo, Customer","Invoice ""A"""',
      ].join('\n'),
      { bankAccountId: 'bank-account-1', type: 'INFLOW' },
    );

    expect(rows).toEqual([
      expect.objectContaining({
        amount: '1,250,000',
        bankAccountId: 'bank-account-1',
        counterpartyName: 'Demo, Customer',
        description: 'Invoice "A"',
        occurredAt: '2026-07-14T08:00:00.000Z',
        rowNumber: 2,
        transferRef: 'VCB-100',
        type: 'INFLOW',
      }),
    ]);
  });

  it('rejects missing required columns and batches larger than 50 rows', () => {
    expect(() =>
      parseBankStatementCsv('reference,description\nVCB-1,Missing values', {
        bankAccountId: 'bank-account-1',
        type: 'INFLOW',
      }),
    ).toThrow('requires amount and transaction date');

    const csv = ['date,amount', ...Array.from({ length: 51 }, (_, index) => `2026-07-14,${index + 1}`)].join(
      '\n',
    );
    expect(() =>
      parseBankStatementCsv(csv, { bankAccountId: 'bank-account-1', type: 'OUTFLOW' }),
    ).toThrow('up to 50');
  });

  it('recognizes settlement-provider aliases and generates stable HANDS templates', () => {
    expect(
      parseBankStatementCsv(
        [
          'transaction_time,amount,transaction_id,partner_name,description,currency',
          '2026-07-14T08:00:00+07:00,1250000,MOMO-TXN-1,Example Partner,Settlement,VND',
        ].join('\n'),
        { bankAccountId: 'bank-account-1', type: 'INFLOW' },
        'MOMO',
      ),
    ).toEqual([
      expect.objectContaining({
        occurredAt: '2026-07-14T08:00:00+07:00',
        transferRef: 'MOMO-TXN-1',
        counterpartyName: 'Example Partner',
      }),
    ]);

    expect(bankStatementCsvTemplate('GENERIC')).toContain('occurredAt,amount,transferRef');
    expect(bankStatementCsvTemplate('VCB')).toContain('transaction_date,amount,reference');
    expect(bankStatementCsvTemplate('MOMO')).toContain('transaction_time,amount,transaction_id');
    expect(bankStatementCsvTemplate('VNPAY')).toContain('transaction_time,amount,transaction_no');
  });

  it('exports only issue evidence and creates a reusable retry file for skipped rows', () => {
    const report = bankStatementCsvIssueReport([
      {
        batchCandidateRowNumbers: [],
        candidates: [],
        classification: 'NEW',
        errors: [],
        normalized: null,
        raw: { amount: '100000', counterpartyName: '', occurredAt: '2026-07-14', transferRef: 'NEW-1', valueDate: '' },
        rowNumber: 2,
      },
      {
        batchCandidateRowNumbers: [],
        candidates: [],
        classification: 'INVALID',
        errors: ['Amount must be a positive whole number', 'Occurred at must be a valid date and time'],
        normalized: null,
        raw: {
          amount: 'bad',
          counterpartyName: 'Example Customer',
          occurredAt: '31/02/2026',
          transferRef: 'BAD-1',
          valueDate: '',
        },
        rowNumber: 3,
      },
      {
        batchCandidateRowNumbers: [2],
        candidates: [{ id: 'bank-existing-1' }],
        classification: 'EXACT_DUPLICATE',
        errors: [],
        normalized: null,
        raw: { amount: '100000', counterpartyName: '', occurredAt: '2026-07-14', transferRef: 'DUP-1', valueDate: '' },
        rowNumber: 4,
      },
    ] as never);

    expect(report).not.toContain('NEW-1');
    expect(report).toContain('BAD-1');
    expect(report).toContain('Amount must be a positive whole number; Occurred at must be a valid date and time');
    expect(report).toContain('bank-existing-1');
    expect(report).toContain('Exact duplicate; do not import again');

    const retry = bankStatementCsvRetryFile([
      {
        amount: 'bad',
        bankAccountId: 'bank-account-1',
        counterpartyName: 'Example Customer',
        occurredAt: '31/02/2026',
        rowNumber: 3,
        transferRef: 'BAD-1',
        type: 'INFLOW',
      },
    ]);
    expect(retry).toContain('occurredAt,amount,transferRef');
    expect(retry).toContain('31/02/2026,bad,BAD-1,Example Customer');
    expect(retry).not.toContain('bank-account-1');
  });
});
