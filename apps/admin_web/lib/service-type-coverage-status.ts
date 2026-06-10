type ServiceTypeCoverageStatusInput = {
  readonly belowMinimumCount: number;
  readonly lowCommissionCount: number;
  readonly missingBasePayoutCount: number;
  readonly missingDurations: readonly number[];
  readonly missingPayoutPriceCount: number;
};

type ServiceTypeCoverageStatus = {
  readonly nextAction: string;
  readonly statusLabel: string;
  readonly tone: 'pill-danger' | 'pill-success' | 'pill-warn';
};

export function serviceTypeCoverageStatus({
  belowMinimumCount,
  lowCommissionCount,
  missingBasePayoutCount,
  missingDurations,
  missingPayoutPriceCount,
}: ServiceTypeCoverageStatusInput): ServiceTypeCoverageStatus {
  if (missingBasePayoutCount > 0) {
    return {
      tone: 'pill-danger',
      statusLabel: 'Base payout missing',
      nextAction: 'Add payout rules at the minimum customer price for every active duration option.',
    };
  }

  if (belowMinimumCount > 0) {
    return {
      tone: 'pill-danger',
      statusLabel: 'Partner price blocked',
      nextAction: 'Raise partner prices below the admin minimum or intentionally lower the service minimum.',
    };
  }

  if (missingPayoutPriceCount > 0) {
    return {
      tone: 'pill-warn',
      statusLabel: 'Partner price hidden',
      nextAction: 'Add payout rules for active partner prices that should be visible to customers.',
    };
  }

  if (lowCommissionCount > 0) {
    return {
      tone: 'pill-warn',
      statusLabel: 'Commission check',
      nextAction: 'Adjust partner payout, VAT, withholding, or other cost assumptions before scaling.',
    };
  }

  if (missingDurations.length > 0) {
    return {
      tone: 'pill-warn',
      statusLabel: 'Duration gap',
      nextAction: 'Add missing 60, 90, or 120 minute options when this service type should be complete.',
    };
  }

  return {
    tone: 'pill-success',
    statusLabel: 'Ready',
    nextAction: 'Ready for customer booking with configured duration and payout coverage.',
  };
}
