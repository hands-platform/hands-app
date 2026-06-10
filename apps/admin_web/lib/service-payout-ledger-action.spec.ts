import { servicePayoutLedgerAction } from './service-payout-ledger-action';

describe('service payout ledger action', () => {
  it('blocks rows missing a base payout rule', () => {
    expect(
      servicePayoutLedgerAction({
        actualCompanyCommission: 0,
        hasBaseRule: false,
        hiddenProviders: 0,
      }),
    ).toEqual({
      action: 'Add payout rule',
      actionTone: 'pill-danger',
      commissionTone: 'pill-danger',
    });
  });

  it('warns when projected commission is not positive', () => {
    expect(
      servicePayoutLedgerAction({
        actualCompanyCommission: 0,
        hasBaseRule: true,
        hiddenProviders: 0,
      }),
    ).toEqual({
      action: 'Review margin',
      actionTone: 'pill-warn',
      commissionTone: 'pill-warn',
    });
  });

  it('asks operators to fix hidden prices before marking ready', () => {
    expect(
      servicePayoutLedgerAction({
        actualCompanyCommission: 1200,
        hasBaseRule: true,
        hiddenProviders: 2,
      }),
    ).toEqual({
      action: 'Fix hidden prices',
      actionTone: 'pill-danger',
      commissionTone: 'pill-success',
    });
  });

  it('returns ready when payout rule, commission, and partner prices are healthy', () => {
    expect(
      servicePayoutLedgerAction({
        actualCompanyCommission: 1200,
        hasBaseRule: true,
        hiddenProviders: 0,
      }),
    ).toEqual({
      action: 'Ready',
      actionTone: 'pill-success',
      commissionTone: 'pill-success',
    });
  });
});
