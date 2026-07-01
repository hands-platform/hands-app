import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../lib/admin-api';
import BankReconciliationDetailPage from './bank-reconciliation/[id]/page';
import GeneralLedgerDetailPage from './general-ledger/[id]/page';
import PaymentClearingDetailPage from './payment-clearing/[id]/page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('finance detail pages', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
  });

  it('renders payment clearing detail evidence and related navigation', async () => {
    mockedAdminGet.mockResolvedValue({
      amount: 650000,
      bankReconciliationMatches: [
        {
          accountingJournalEntry: {
            accountCode: '1121',
            accountName: 'Payment clearing receivable',
            batchId: 'journal-batch-1',
            id: 'journal-entry-1',
          },
          amount: 650000,
          bankTransaction: {
            amount: 650000,
            counterpartyName: 'Demo Customer',
            currency: 'VND',
            id: 'bank-transaction-1',
            occurredAt: '2026-06-20T10:00:00.000Z',
            sourceKey: 'bank:transaction:1',
            status: 'MATCHED',
            transferRef: 'BANK-IN-001',
            type: 'INFLOW',
          },
          bankTransactionId: 'bank-transaction-1',
          currency: 'VND',
          id: 'match-1',
          matchedAt: '2026-06-20T10:05:00.000Z',
          sourceKey: 'bank-match:clearing-1',
          status: 'MATCHED',
        },
      ],
      bookingId: 'booking-1',
      createdAt: '2026-06-20T09:00:00.000Z',
      currency: 'VND',
      id: 'clearing-1',
      occurredAt: '2026-06-20T09:10:00.000Z',
      payment: {
        amount: 650000,
        currency: 'VND',
        id: 'payment-1',
        method: 'CARD',
        status: 'CAPTURED',
      },
      paymentId: 'payment-1',
      sourceKey: 'payment:payment-1:capture',
      status: 'CLEARED',
      type: 'CUSTOMER_PAYMENT_CAPTURED',
      updatedAt: '2026-06-20T10:05:00.000Z',
    });

    const page = await PaymentClearingDetailPage({ params: Promise.resolve({ id: 'clearing-1' }) });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/booking-payment-clearing/clearing-1', null);
    expect(markup).toContain('Payment Clearing Detail');
    expect(markup).toContain('Clearing overview');
    expect(markup).toContain('/bookings/booking-1');
    expect(markup).toContain('/finance-tax/bank-reconciliation/bank-transaction-1');
    expect(markup).toContain('/finance-tax/general-ledger/journal-batch-1');
    expect(markup).toContain('Bank reconciliation matches');
    expect(markup).toContain('finance-detail-info-item');
    expect(markup).toContain('card admin-filter-panel admin-mb-16');
    expect(markup).not.toContain('<div class="detail-grid admin-mt-16"><div class="card">');
    expect(markup).not.toContain('<section class="card admin-mb-16">');
    expect(markup).toContain('vuexy-booking-table-card');
    expect(markup).toContain('vuexy-booking-table');
  });

  it('renders general ledger detail journal rows and evidence links', async () => {
    mockedAdminGet.mockResolvedValue({
      _count: { entries: 2 },
      bookingId: 'booking-1',
      createdAt: '2026-06-20T09:00:00.000Z',
      currency: 'VND',
      entries: [
        {
          accountCode: '1121',
          accountName: 'Payment clearing receivable',
          amount: 650000,
          bankReconciliationMatches: [
            {
              amount: 650000,
              bankTransactionId: 'bank-transaction-1',
              currency: 'VND',
              id: 'match-1',
              matchedAt: '2026-06-20T10:05:00.000Z',
              paymentClearingEntryId: 'clearing-1',
              sourceKey: 'bank-match:journal-entry-1',
              status: 'MATCHED',
            },
          ],
          createdAt: '2026-06-20T09:10:00.000Z',
          currency: 'VND',
          id: 'journal-entry-1',
          memo: 'Customer card capture',
          side: 'DEBIT',
          sourceId: 'payment-1',
          sourceType: 'PAYMENT_CALLBACK',
        },
      ],
      id: 'journal-batch-1',
      monthlyPeriod: '2026-06',
      payment: {
        amount: 650000,
        createdAt: '2026-06-20T09:00:00.000Z',
        currency: 'VND',
        id: 'payment-1',
        method: 'CARD',
        status: 'CAPTURED',
      },
      paymentId: 'payment-1',
      postedAt: '2026-06-20T09:10:00.000Z',
      sourceId: 'payment-1',
      sourceKey: 'journal:payment-1',
      sourceType: 'PAYMENT_CALLBACK',
      status: 'POSTED',
      totalCredit: 650000,
      totalDebit: 650000,
      updatedAt: '2026-06-20T09:10:00.000Z',
    });

    const page = await GeneralLedgerDetailPage({ params: Promise.resolve({ id: 'journal-batch-1' }) });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/accounting-journal-batches/journal-batch-1', null);
    expect(markup).toContain('General Ledger Detail');
    expect(markup).toContain('Journal batch overview');
    expect(markup).toContain('Journal entries');
    expect(markup).toContain('/bookings/booking-1');
    expect(markup).toContain('/finance-tax/bank-reconciliation/bank-transaction-1');
    expect(markup).toContain('/finance-tax/payment-clearing/clearing-1');
    expect(markup).toContain('finance-detail-info-item');
    expect(markup).toContain('card admin-filter-panel admin-mb-16');
    expect(markup).not.toContain('<div class="detail-grid admin-mt-16"><div class="card">');
    expect(markup).not.toContain('<section class="card admin-mb-16">');
    expect(markup).toContain('vuexy-booking-table-card');
    expect(markup).toContain('vuexy-booking-table');
  });

  it('renders bank reconciliation detail and manual match controls', async () => {
    mockedAdminGet.mockResolvedValue({
      amount: 650000,
      bankAccount: {
        accountNumberMasked: '****1234',
        bankName: 'Vietcombank',
        currency: 'VND',
        id: 'bank-account-1',
        name: 'HANDS Operating',
        status: 'ACTIVE',
      },
      bankAccountId: 'bank-account-1',
      counterpartyName: 'Demo Customer',
      createdAt: '2026-06-20T10:00:00.000Z',
      currency: 'VND',
      description: 'Card payout clearing',
      id: 'bank-transaction-1',
      occurredAt: '2026-06-20T10:00:00.000Z',
      reconciliationMatches: [
        {
          accountingJournalEntry: {
            accountCode: '1121',
            accountName: 'Payment clearing receivable',
            amount: 650000,
            batchId: 'journal-batch-1',
            currency: 'VND',
            id: 'journal-entry-1',
            side: 'DEBIT',
          },
          accountingJournalEntryId: 'journal-entry-1',
          amount: 650000,
          currency: 'VND',
          id: 'match-1',
          matchedAt: '2026-06-20T10:05:00.000Z',
          paymentClearingEntry: {
            amount: 650000,
            bookingId: 'booking-1',
            currency: 'VND',
            id: 'clearing-1',
            occurredAt: '2026-06-20T09:10:00.000Z',
            sourceKey: 'payment:payment-1:capture',
            status: 'CLEARED',
            type: 'CUSTOMER_PAYMENT_CAPTURED',
          },
          paymentClearingEntryId: 'clearing-1',
          sourceKey: 'bank-match:bank-transaction-1',
          status: 'MATCHED',
        },
      ],
      sourceKey: 'bank:transaction:1',
      status: 'MATCHED',
      transferRef: 'BANK-IN-001',
      type: 'INFLOW',
      updatedAt: '2026-06-20T10:05:00.000Z',
      valueDate: '2026-06-20T00:00:00.000Z',
    });

    const page = await BankReconciliationDetailPage({
      params: Promise.resolve({ id: 'bank-transaction-1' }),
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/bank-reconciliation/bank-transaction-1', null);
    expect(markup).toContain('Bank Reconciliation Detail');
    expect(markup).toContain('Bank transaction overview');
    expect(markup).toContain('Manual reconciliation match');
    expect(markup).toContain('card admin-filter-panel admin-mb-16');
    expect(markup).toContain('/finance-tax/general-ledger/journal-batch-1');
    expect(markup).toContain('/finance-tax/payment-clearing/clearing-1');
    expect(markup).toContain('Create match');
    expect(markup).toContain('finance-detail-info-item');
    expect(markup).not.toContain('<div class="detail-grid admin-mt-16"><div class="card">');
    expect(markup).not.toContain('<section class="card admin-mb-16">');
    expect(markup).toContain('vuexy-booking-table-card');
    expect(markup).toContain('vuexy-booking-table');
  });
});
