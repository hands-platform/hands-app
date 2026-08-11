import {
  buildPartnerBankPayoutGateView,
  buildPartnerTaxProfileView,
  partnerBankReviewState,
} from './partner-detail-bank-tax-model';
import type {
  ProviderBankAccount,
  ProviderDetail,
} from './partner-detail-types';

function providerFixture(overrides: Partial<ProviderDetail> = {}): ProviderDetail {
  return overrides as ProviderDetail;
}

function bankFixture(
  overrides: Partial<ProviderBankAccount> = {},
): ProviderBankAccount {
  return {
    accountHolderName: 'Tran Linh',
    accountNumberLast4: '1234',
    bankName: 'Vietcombank',
    id: 'bank-current',
    isPrimary: true,
    status: 'PENDING_REVIEW',
    ...overrides,
  } as ProviderBankAccount;
}

describe('partner detail bank and tax model', () => {
  it('classifies a corrected bank submission and preserves review links', () => {
    const bank = bankFixture();
    const rejectedBank = bankFixture({
      id: 'bank-rejected',
      isPrimary: false,
      status: 'REJECTED',
    });
    const view = buildPartnerBankPayoutGateView('partner-1', bank, [bank, rejectedBank]);

    expect(partnerBankReviewState(bank, [bank, rejectedBank])).toMatchObject({
      label: 'Bank correction submitted',
    });
    expect(view).toMatchObject({
      accountLabel: '1234',
      reviewStateLabel: 'Bank correction submitted',
      status: 'PENDING_REVIEW',
    });
    expect(view?.reviewActions.map(actionHref)).toEqual([
      expect.stringContaining('reviewAction=approve-bank'),
      expect.stringContaining('reviewAction=reject-bank'),
    ]);
    expect(view?.reviewActions.map(actionHref)).toEqual([
      expect.stringContaining('bankAccountId=bank-current'),
      expect.stringContaining('bankAccountId=bank-current'),
    ]);
  });

  it('disables the matching bank decision after approval or rejection', () => {
    const approved = buildPartnerBankPayoutGateView(
      'partner-1',
      bankFixture({ status: 'APPROVED' }),
    );
    const rejected = buildPartnerBankPayoutGateView(
      'partner-1',
      bankFixture({ status: 'REJECTED' }),
    );

    expect(approved?.reviewActions[0]).toMatchObject({ disabled: true });
    expect(rejected?.reviewActions[1]).toMatchObject({ disabled: true });
    expect(buildPartnerBankPayoutGateView('partner-1', null)).toBeNull();
  });

  it('maps optional tax evidence without exposing the full tax code', () => {
    const view = buildPartnerTaxProfileView(
      providerFixture({
        id: 'partner-1',
        taxProfile: {
          id: 'tax-1',
          legalName: 'Tran Linh',
          registeredAddress: 'Da Nang',
          status: 'PENDING_REVIEW',
          taxCodeLast4: '9876',
        },
      }),
    );

    expect(view).toMatchObject({
      legalName: 'Tran Linh',
      status: 'PENDING_REVIEW',
      taxCodeLabel: '****9876',
    });
    expect(view?.reviewActions.map(actionHref)).toEqual([
      expect.stringContaining('reviewAction=approve-tax'),
      expect.stringContaining('reviewAction=reject-tax'),
    ]);
    expect(buildPartnerTaxProfileView(providerFixture({ id: 'partner-2' }))).toBeNull();
  });
});

function actionHref(action: { readonly kind: string; readonly href?: string }) {
  return action.kind === 'link' ? action.href : undefined;
}
