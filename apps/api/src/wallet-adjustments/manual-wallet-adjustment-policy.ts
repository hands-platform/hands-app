import type {
  ManualWalletAdjustmentDirection,
  ManualWalletAdjustmentOwnerType,
  ManualWalletAdjustmentType,
} from './wallet-adjustments.accounting';

export const MANUAL_WALLET_ADJUSTMENT_POLICY_ERROR_CODES = {
  COMBINATION_NOT_ALLOWED: 'WALLET_ADJUSTMENT_COMBINATION_NOT_ALLOWED',
  PERIOD_NOT_FOUND: 'WALLET_ADJUSTMENT_PERIOD_NOT_FOUND',
  PERIOD_NOT_OPEN: 'WALLET_ADJUSTMENT_PERIOD_NOT_OPEN',
  PERIOD_REQUIRED: 'WALLET_ADJUSTMENT_PERIOD_REQUIRED',
  REVERSAL_SOURCE_REQUIRED: 'WALLET_ADJUSTMENT_REVERSAL_SOURCE_REQUIRED',
  SETTLEMENT_ROUTE_REQUIRED: 'WALLET_ADJUSTMENT_SETTLEMENT_ROUTE_REQUIRED',
} as const;

export const MANUAL_WALLET_ADJUSTMENT_POLICY_LIMITS = {
  amountMax: 1_000_000_000,
  attachmentRequiredAt: 10_000_000,
  attachmentUrlMaxLength: 500,
  reasonMaxLength: 1_000,
} as const;

export type ManualWalletAdjustmentPolicyErrorCode =
  (typeof MANUAL_WALLET_ADJUSTMENT_POLICY_ERROR_CODES)[keyof typeof MANUAL_WALLET_ADJUSTMENT_POLICY_ERROR_CODES];

export type ManualWalletAdjustmentPeriodStatus =
  | 'DRAFT'
  | 'REVIEWED'
  | 'DECLARED'
  | 'PAID'
  | 'CLOSED';

export class ManualWalletAdjustmentPolicyError extends Error {
  constructor(
    readonly code: ManualWalletAdjustmentPolicyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ManualWalletAdjustmentPolicyError';
  }
}

type PolicyKey = `${ManualWalletAdjustmentOwnerType}:${ManualWalletAdjustmentDirection}`;

const ALLOWED_MANUAL_ADJUSTMENT_TYPES: Readonly<Record<PolicyKey, readonly ManualWalletAdjustmentType[]>> = {
  'CUSTOMER:CREDIT': [
    'PROMOTION_CREDIT',
    'CUSTOMER_COMPENSATION',
    'REFERRAL_CORRECTION',
    'ERROR_CORRECTION',
  ],
  'CUSTOMER:DEBIT': ['REFERRAL_CORRECTION', 'ERROR_CORRECTION'],
  'PARTNER:CREDIT': [
    'CUSTOMER_COMPENSATION',
    'PARTNER_BONUS',
    'REFERRAL_CORRECTION',
    'ERROR_CORRECTION',
    'RECEIVABLE_WRITE_OFF',
  ],
  'PARTNER:DEBIT': ['REFERRAL_CORRECTION', 'ERROR_CORRECTION', 'PENALTY'],
};

export function getAllowedManualWalletAdjustmentTypes(
  ownerType: ManualWalletAdjustmentOwnerType,
  direction: ManualWalletAdjustmentDirection,
) {
  return ALLOWED_MANUAL_ADJUSTMENT_TYPES[`${ownerType}:${direction}`];
}

export function getManualWalletAdjustmentPolicy() {
  return (Object.entries(ALLOWED_MANUAL_ADJUSTMENT_TYPES) as Array<
    [PolicyKey, readonly ManualWalletAdjustmentType[]]
  >).map(([key, adjustmentTypes]) => {
    const [ownerType, direction] = key.split(':') as [
      ManualWalletAdjustmentOwnerType,
      ManualWalletAdjustmentDirection,
    ];
    return { adjustmentTypes, direction, ownerType };
  });
}

export function assertManualWalletAdjustmentCombinationAllowed(input: {
  adjustmentType: ManualWalletAdjustmentType;
  direction: ManualWalletAdjustmentDirection;
  ownerType: ManualWalletAdjustmentOwnerType;
  reversalOfRequestId?: string | null;
}) {
  if (input.adjustmentType === 'CASH_BOOKING_DEDUCTION') {
    throw new ManualWalletAdjustmentPolicyError(
      MANUAL_WALLET_ADJUSTMENT_POLICY_ERROR_CODES.SETTLEMENT_ROUTE_REQUIRED,
      'Cash booking deductions must use booking settlement logic.',
    );
  }

  if (input.adjustmentType === 'MANUAL_REVERSAL') {
    if (!input.reversalOfRequestId?.trim()) {
      throw new ManualWalletAdjustmentPolicyError(
        MANUAL_WALLET_ADJUSTMENT_POLICY_ERROR_CODES.REVERSAL_SOURCE_REQUIRED,
        'Manual reversals require an executed source request.',
      );
    }
    return;
  }

  if (input.reversalOfRequestId?.trim()) {
    throwCombinationNotAllowed(input);
  }

  if (!getAllowedManualWalletAdjustmentTypes(input.ownerType, input.direction).includes(input.adjustmentType)) {
    throwCombinationNotAllowed(input);
  }
}

export function assertManualWalletAdjustmentPeriodOpen(input: {
  monthlyPeriod: string | null | undefined;
  monthlyPeriodStatus: ManualWalletAdjustmentPeriodStatus | null | undefined;
}) {
  if (!input.monthlyPeriod?.trim()) {
    throw new ManualWalletAdjustmentPolicyError(
      MANUAL_WALLET_ADJUSTMENT_POLICY_ERROR_CODES.PERIOD_REQUIRED,
      'An accounting month is required for every manual wallet adjustment.',
    );
  }

  if (!input.monthlyPeriodStatus) {
    throw new ManualWalletAdjustmentPolicyError(
      MANUAL_WALLET_ADJUSTMENT_POLICY_ERROR_CODES.PERIOD_NOT_FOUND,
      `Accounting month ${input.monthlyPeriod} was not found.`,
    );
  }

  if (input.monthlyPeriodStatus !== 'DRAFT' && input.monthlyPeriodStatus !== 'REVIEWED') {
    throw new ManualWalletAdjustmentPolicyError(
      MANUAL_WALLET_ADJUSTMENT_POLICY_ERROR_CODES.PERIOD_NOT_OPEN,
      `Accounting month ${input.monthlyPeriod} is ${input.monthlyPeriodStatus.toLowerCase()} and cannot accept manual wallet entries.`,
    );
  }
}

function throwCombinationNotAllowed(input: {
  adjustmentType: ManualWalletAdjustmentType;
  direction: ManualWalletAdjustmentDirection;
  ownerType: ManualWalletAdjustmentOwnerType;
}): never {
  throw new ManualWalletAdjustmentPolicyError(
    MANUAL_WALLET_ADJUSTMENT_POLICY_ERROR_CODES.COMBINATION_NOT_ALLOWED,
    `${input.adjustmentType} is not allowed for ${input.ownerType} ${input.direction.toLowerCase()} adjustments.`,
  );
}
