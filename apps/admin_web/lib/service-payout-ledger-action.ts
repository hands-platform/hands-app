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
  const commissionTone = servicePayoutCommissionTone({ actualCompanyCommission, hasBaseRule });
  const action = servicePayoutNextAction({ actualCompanyCommission, hasBaseRule, hiddenProviders });
  const actionTone = servicePayoutActionTone(action);

  return {
    action,
    actionTone,
    commissionTone,
  };
}

function servicePayoutCommissionTone({
  actualCompanyCommission,
  hasBaseRule,
}: Pick<ServicePayoutLedgerActionInput, 'actualCompanyCommission' | 'hasBaseRule'>) {
  if (!hasBaseRule) {
    return 'pill-danger';
  }
  return actualCompanyCommission <= 0 ? 'pill-warn' : 'pill-success';
}

function servicePayoutNextAction({
  actualCompanyCommission,
  hasBaseRule,
  hiddenProviders,
}: ServicePayoutLedgerActionInput): ServicePayoutLedgerAction['action'] {
  if (!hasBaseRule) {
    return 'Add payout rule';
  }
  if (actualCompanyCommission <= 0) {
    return 'Review margin';
  }
  return hiddenProviders ? 'Fix hidden prices' : 'Ready';
}

function servicePayoutActionTone(action: ServicePayoutLedgerAction['action']) {
  if (action === 'Ready') {
    return 'pill-success';
  }
  if (action === 'Review margin') {
    return 'pill-warn';
  }
  return 'pill-danger';
}
