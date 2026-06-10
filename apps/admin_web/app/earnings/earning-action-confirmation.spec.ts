import {
  buildEarningActionConfirmation,
  earningActionConfirmHref,
  readEarningConfirmationAction,
  type EarningPayoutConfirmationRow,
  type EarningSettlementConfirmationRow,
} from './earning-action-confirmation';

const settlementRow = {
  currency: 'VND',
  debtAmount: 90000,
  earningId: 'earning-debt-123456',
  paymentMethod: 'CASH',
  providerName: 'Partner Debt',
  settlementReference: 'HANDS-CASH-123',
} satisfies EarningSettlementConfirmationRow;

const payoutRow = {
  currency: 'VND',
  providerName: 'Partner Ready',
  providerProfileId: 'partner-ready-123456',
  transferRef: 'HANDS-partner',
  unbatchedCount: 3,
  unbatchedNet: 450000,
} satisfies EarningPayoutConfirmationRow;

const emptyInput = {
  action: null,
  earningId: '',
  providerProfileId: '',
  settlementMethod: '',
  settlementNotes: '',
  settlementRef: '',
  transferRef: '',
};

describe('earning action confirmation', () => {
  it('builds a cash fee settlement confirmation', () => {
    const confirmation = buildEarningActionConfirmation([settlementRow], [payoutRow], {
      ...emptyInput,
      action: 'mark-paid',
      earningId: settlementRow.earningId,
      settlementMethod: 'PARTNER_DEPOSIT',
      settlementNotes: 'Deposit confirmed.',
      settlementRef: 'BANK-123',
    });

    expect(confirmation).toEqual({
      action: 'mark-paid',
      cancelHref: '/earnings',
      confirmLabel: 'Confirm fee settlement',
      description:
        'Partner Debt will settle 90.000 VND cash fee debt by partner deposit. Payment method: CASH. Reference: BANK-123.',
      hiddenInputs: [
        { name: 'earningId', value: settlementRow.earningId },
        { name: 'settlementMethod', value: 'PARTNER_DEPOSIT' },
        { name: 'settlementRef', value: 'BANK-123' },
        { name: 'settlementNotes', value: 'Deposit confirmed.' },
      ],
      title: 'Confirm earning fee settlement earning-?',
      tone: 'danger',
    });
  });

  it('builds a payout batch confirmation', () => {
    const confirmation = buildEarningActionConfirmation([settlementRow], [payoutRow], {
      ...emptyInput,
      action: 'create-payout',
      providerProfileId: payoutRow.providerProfileId,
      transferRef: 'TRANSFER-1',
    });

    expect(confirmation).toEqual({
      action: 'create-payout',
      cancelHref: '/earnings',
      confirmLabel: 'Create payout batch',
      description:
        'Create a payout batch for Partner Ready: 3 earning(s), net 450.000 VND. Transfer reference: TRANSFER-1.',
      hiddenInputs: [
        { name: 'providerProfileId', value: payoutRow.providerProfileId },
        { name: 'transferRef', value: 'TRANSFER-1' },
      ],
      title: 'Create payout batch for Partner Ready?',
      tone: 'warning',
    });
  });

  it('returns null for unknown or unloaded confirmation targets', () => {
    expect(buildEarningActionConfirmation([settlementRow], [payoutRow], emptyInput)).toBeNull();
    expect(
      buildEarningActionConfirmation([settlementRow], [payoutRow], {
        ...emptyInput,
        action: 'mark-paid',
        earningId: 'missing',
      }),
    ).toBeNull();
  });

  it('reads only supported confirmation actions', () => {
    expect(readEarningConfirmationAction('create-payout')).toBe('create-payout');
    expect(readEarningConfirmationAction('mark-paid')).toBe('mark-paid');
    expect(readEarningConfirmationAction('delete')).toBeNull();
  });

  it('encodes confirmation URL fields', () => {
    expect(
      earningActionConfirmHref({
        action: 'mark-paid',
        earningId: 'earning 1',
        providerProfileId: '',
        settlementMethod: 'ADMIN_OFFSET',
        settlementNotes: 'Approved offset',
        settlementRef: 'REF 1',
        transferRef: '',
      }),
    ).toBe(
      '/earnings?confirm=mark-paid&earningId=earning+1&settlementMethod=ADMIN_OFFSET&settlementNotes=Approved+offset&settlementRef=REF+1',
    );
  });
});
