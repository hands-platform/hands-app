import { AdminOperationalPolicySetting } from '../../lib/admin-api';
import { buildActionGatePolicyChecklist } from './action-gate-policy-checklist';

const formatPolicyValue = (
  _settings: AdminOperationalPolicySetting[],
  _key: string,
  value: string | number,
) => `formatted:${value}`;

describe('action gate policy checklist', () => {
  it('uses the recommended MVP posture when no owner overrides are saved', () => {
    const checklist = buildActionGatePolicyChecklist([], formatPolicyValue);

    expect(checklist.alignedCount).toBe(5);
    expect(checklist.totalCount).toBe(5);
    expect(checklist.summary[0]).toMatchObject({
      label: 'Recommended posture',
      value: '5/5',
    });
    expect(checklist.cards.map((card) => card.status)).toEqual([
      'Recommended',
      'Recommended',
      'Recommended',
      'Recommended',
      'Recommended',
    ]);
  });

  it('marks saved owner overrides without losing the policy anchor href', () => {
    const settings = [
      {
        key: 'payout.batch_cycle_policy',
        value: 'ADMIN_SELECTED_DAY_BATCH',
      },
    ] as AdminOperationalPolicySetting[];

    const checklist = buildActionGatePolicyChecklist(settings, formatPolicyValue);
    const payoutCard = checklist.cards.find((card) => card.title === 'Payout batch cycle');

    expect(checklist.alignedCount).toBe(4);
    expect(payoutCard).toMatchObject({
      status: 'Owner override',
      current: 'formatted:ADMIN_SELECTED_DAY_BATCH',
      href: '/operations-policy#policy-payout-batch-cycle-policy',
      pillClass: 'pill-warn',
    });
  });
});
