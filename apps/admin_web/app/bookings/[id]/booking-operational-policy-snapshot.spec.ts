import type { AdminOperationalPolicySetting } from '../../../lib/admin-api';
import { OPERATIONAL_POLICY_KEYS } from '../../../lib/operations-policy';
import { bookingOperationalPolicySnapshot } from './booking-operational-policy-snapshot';

function setting(
  key: string,
  value: string,
  options: Array<{ label: string; value: string }> = [],
): AdminOperationalPolicySetting {
  return {
    key,
    options,
    value,
  } as AdminOperationalPolicySetting;
}

describe('bookingOperationalPolicySnapshot', () => {
  it('describes cash fee clearance as a final acceptance and service start gate', () => {
    const snapshot = bookingOperationalPolicySnapshot(
      {
        id: 'booking-policy-copy',
        participants: [],
        selectedProvider: null,
        status: 'OPEN_MATCHING',
      } as never,
      [
        setting(OPERATIONAL_POLICY_KEYS.cashSettlementClearance, 'DEPOSIT_REFERENCE_REQUIRED', [
          { label: 'Deposit reference required', value: 'DEPOSIT_REFERENCE_REQUIRED' },
        ]),
      ],
    );

    expect(snapshot.decisionCards.find((card) => card.label === 'Cash fee clearance')?.helper).toBe(
      'Cash fee debt clearance should include a company deposit reference before final acceptance, service start, or payout release.',
    );
  });
});
