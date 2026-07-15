import {
  buildCashSettlementConfirmation,
  cashSettlementConfirmHref,
  type CashSettlementConfirmationRow,
} from './cash-settlement-action-confirmation';

const settlementRow = {
  debtAmount: 125000,
  earning: {
    currency: 'VND',
    id: 'earning-cash-123456',
    settlementMethod: null,
  },
  paymentMethod: 'CASH',
  providerName: 'Partner A',
  settlementReference: 'HANDS-CASH-BOOKING',
} satisfies CashSettlementConfirmationRow;

describe('cash settlement action confirmation', () => {
  it('routes legacy Partner deposit confirmation input to documented admin offset only', () => {
    const confirmation = buildCashSettlementConfirmation([settlementRow], {
      earningId: settlementRow.earning.id,
      settlementMethod: 'PARTNER_DEPOSIT',
      settlementNotes: 'Deposit confirmed by finance.',
      settlementRef: 'BANK-001',
    });

    expect(confirmation).toEqual({
      cancelHref: '/cash-settlements',
      confirmLabel: 'Confirm settlement',
      description:
        'Partner A will settle 125.000 VND by admin offset. Payment method: CASH. Reference: BANK-001.',
      earningId: settlementRow.earning.id,
      settlementMethod: 'ADMIN_OFFSET',
      settlementNotes: 'Deposit confirmed by finance.',
      settlementRef: 'BANK-001',
      title: 'Confirm cash settlement earning-?',
      tone: 'warning',
    });
  });

  it('uses admin offset tone when settlement method is admin offset', () => {
    const confirmation = buildCashSettlementConfirmation([settlementRow], {
      earningId: settlementRow.earning.id,
      settlementMethod: 'ADMIN_OFFSET',
      settlementNotes: '',
      settlementRef: '',
    });

    expect(confirmation?.settlementMethod).toBe('ADMIN_OFFSET');
    expect(confirmation?.settlementRef).toBe('HANDS-CASH-BOOKING');
    expect(confirmation?.tone).toBe('warning');
  });

  it('returns null when the earning row is not loaded', () => {
    expect(
      buildCashSettlementConfirmation([settlementRow], {
        earningId: 'missing',
        settlementMethod: 'PARTNER_DEPOSIT',
        settlementNotes: '',
        settlementRef: '',
      }),
    ).toBeNull();
  });

  it('encodes confirmation URL fields', () => {
    expect(
      cashSettlementConfirmHref({
        earningId: 'earning 1',
        settlementMethod: 'ADMIN_OFFSET',
        settlementNotes: 'Manual offset approved',
        settlementRef: 'REF 1',
      }),
    ).toBe(
      '/cash-settlements?confirm=settle&earningId=earning+1&settlementMethod=ADMIN_OFFSET&settlementNotes=Manual+offset+approved&settlementRef=REF+1',
    );
  });
});
