type ServicePayoutLedgerActionInput = {
  readonly actualCompanyCommission: number;
  readonly hasBaseRule: boolean;
  readonly hiddenProviders: number;
};

type ServicePayoutLedgerAction = {
  readonly action: 'Add payout rule' | 'Fix hidden prices' | 'Ready' | 'Review margin';
  readonly actionTone: 'pill-danger' | 'pill-success' | 'pill-warn';
  readonly commissionTone: 'pill-danger' | 'pill-success' | 'pill-warn';
};

export function servicePayoutLedgerAction({
  actualCompanyCommission,
  hasBaseRule,
  hiddenProviders,
}: ServicePayoutLedgerActionInput): ServicePayoutLedgerAction {
  const commissionTone = !hasBaseRule
    ? 'pill-danger'
    : actualCompanyCommission <= 0
      ? 'pill-warn'
      : 'pill-success';
  const action = !hasBaseRule
    ? 'Add payout rule'
    : actualCompanyCommission <= 0
      ? 'Review margin'
      : hiddenProviders
        ? 'Fix hidden prices'
        : 'Ready';
  const actionTone =
    action === 'Ready' ? 'pill-success' : action === 'Review margin' ? 'pill-warn' : 'pill-danger';

  return {
    action,
    actionTone,
    commissionTone,
  };
}
