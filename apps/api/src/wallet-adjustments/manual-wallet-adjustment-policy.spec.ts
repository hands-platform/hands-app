import {
  assertManualWalletAdjustmentCombinationAllowed,
  assertManualWalletAdjustmentPeriodOpen,
  getAllowedManualWalletAdjustmentTypes,
  MANUAL_WALLET_ADJUSTMENT_POLICY_ERROR_CODES,
  ManualWalletAdjustmentPolicyError,
} from './manual-wallet-adjustment-policy';
import type {
  ManualWalletAdjustmentDirection,
  ManualWalletAdjustmentOwnerType,
  ManualWalletAdjustmentType,
} from './wallet-adjustments.accounting';

const OWNER_TYPES: readonly ManualWalletAdjustmentOwnerType[] = ['CUSTOMER', 'PARTNER'];
const DIRECTIONS: readonly ManualWalletAdjustmentDirection[] = ['CREDIT', 'DEBIT'];
const ADJUSTMENT_TYPES: readonly ManualWalletAdjustmentType[] = [
  'PROMOTION_CREDIT',
  'CUSTOMER_COMPENSATION',
  'PARTNER_BONUS',
  'REFERRAL_CORRECTION',
  'ERROR_CORRECTION',
  'PENALTY',
  'CASH_BOOKING_DEDUCTION',
  'RECEIVABLE_WRITE_OFF',
  'MANUAL_REVERSAL',
];

describe('manual wallet adjustment allowlist', () => {
  it.each(
    OWNER_TYPES.flatMap((ownerType) =>
      DIRECTIONS.flatMap((direction) =>
        ADJUSTMENT_TYPES.map((adjustmentType) => ({ adjustmentType, direction, ownerType })),
      ),
    ),
  )('applies deny-by-default policy to $ownerType $direction $adjustmentType', (input) => {
    const allowed = getAllowedManualWalletAdjustmentTypes(input.ownerType, input.direction).includes(
      input.adjustmentType,
    );

    if (allowed) {
      expect(() => assertManualWalletAdjustmentCombinationAllowed(input)).not.toThrow();
      return;
    }

    try {
      assertManualWalletAdjustmentCombinationAllowed(input);
      throw new Error('Expected policy rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(ManualWalletAdjustmentPolicyError);
      expect((error as ManualWalletAdjustmentPolicyError).code).toBe(
        input.adjustmentType === 'CASH_BOOKING_DEDUCTION'
          ? MANUAL_WALLET_ADJUSTMENT_POLICY_ERROR_CODES.SETTLEMENT_ROUTE_REQUIRED
          : input.adjustmentType === 'MANUAL_REVERSAL'
            ? MANUAL_WALLET_ADJUSTMENT_POLICY_ERROR_CODES.REVERSAL_SOURCE_REQUIRED
            : MANUAL_WALLET_ADJUSTMENT_POLICY_ERROR_CODES.COMBINATION_NOT_ALLOWED,
      );
    }
  });

  it('allows a manual reversal only when its executed source request is supplied', () => {
    expect(() =>
      assertManualWalletAdjustmentCombinationAllowed({
        adjustmentType: 'MANUAL_REVERSAL',
        direction: 'DEBIT',
        ownerType: 'CUSTOMER',
        reversalOfRequestId: 'request-1',
      }),
    ).not.toThrow();
  });

  it('rejects customer partner bonuses and customer receivable write-offs', () => {
    for (const adjustmentType of ['PARTNER_BONUS', 'RECEIVABLE_WRITE_OFF'] as const) {
      expect(() =>
        assertManualWalletAdjustmentCombinationAllowed({
          adjustmentType,
          direction: 'CREDIT',
          ownerType: 'CUSTOMER',
        }),
      ).toThrow(expect.objectContaining({ code: 'WALLET_ADJUSTMENT_COMBINATION_NOT_ALLOWED' }));
    }
  });
});

describe('manual wallet adjustment accounting period policy', () => {
  it.each(['DRAFT', 'REVIEWED'] as const)('allows the %s period status', (monthlyPeriodStatus) => {
    expect(() =>
      assertManualWalletAdjustmentPeriodOpen({ monthlyPeriod: '2026-08', monthlyPeriodStatus }),
    ).not.toThrow();
  });

  it('requires an accounting month', () => {
    expect(() =>
      assertManualWalletAdjustmentPeriodOpen({ monthlyPeriod: null, monthlyPeriodStatus: null }),
    ).toThrow(expect.objectContaining({ code: 'WALLET_ADJUSTMENT_PERIOD_REQUIRED' }));
  });

  it('fails closed when the accounting month does not exist', () => {
    expect(() =>
      assertManualWalletAdjustmentPeriodOpen({ monthlyPeriod: '2026-08', monthlyPeriodStatus: null }),
    ).toThrow(expect.objectContaining({ code: 'WALLET_ADJUSTMENT_PERIOD_NOT_FOUND' }));
  });

  it.each(['DECLARED', 'PAID', 'CLOSED'] as const)('blocks the %s period status', (monthlyPeriodStatus) => {
    expect(() =>
      assertManualWalletAdjustmentPeriodOpen({ monthlyPeriod: '2026-08', monthlyPeriodStatus }),
    ).toThrow(expect.objectContaining({ code: 'WALLET_ADJUSTMENT_PERIOD_NOT_OPEN' }));
  });
});
