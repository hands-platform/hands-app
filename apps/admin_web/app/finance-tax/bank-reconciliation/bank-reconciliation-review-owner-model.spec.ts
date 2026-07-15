import type { AdminUser } from '../../../lib/admin-api';
import { buildBankReconciliationReviewOwnerOptions } from './bank-reconciliation-review-owner-model';

describe('buildBankReconciliationReviewOwnerOptions', () => {
  it('keeps eligible operators, excludes the current owner, and puts the current operator first', () => {
    const users = [
      adminUser({ id: 'owner-current', fullName: 'Current Owner', categories: ['FINANCE_BANK_RECONCILIATION'] }),
      adminUser({ id: 'operator-other', fullName: 'Another Owner', roles: ['FINANCE_APPROVER'] }),
      adminUser({ id: 'operator-session', fullName: 'Session Owner', roles: ['MASTER_ADMIN'] }),
      adminUser({ id: 'operator-denied', fullName: 'No Finance Access', roles: ['ADMIN'], categories: ['BOOKINGS'] }),
    ];

    expect(
      buildBankReconciliationReviewOwnerOptions(users, 'owner-current', 'operator-session'),
    ).toEqual([
      { label: 'Session Owner · operator-session@hands.test', value: 'operator-session' },
      { label: 'Another Owner · operator-other@hands.test', value: 'operator-other' },
    ]);
  });

  it('allows a legacy Finance approver without stored category permissions', () => {
    const legacyApprover = adminUser({
      id: 'legacy-approver',
      fullName: null,
      roles: ['FINANCE_APPROVER'],
      categories: undefined,
    });

    expect(buildBankReconciliationReviewOwnerOptions([legacyApprover], null, null)).toEqual([
      { label: 'legacy-approver@hands.test', value: 'legacy-approver' },
    ]);
  });
});

function adminUser(input: {
  readonly categories?: string[];
  readonly fullName: string | null;
  readonly id: string;
  readonly roles?: string[];
}): AdminUser {
  return {
    id: input.id,
    email: `${input.id}@hands.test`,
    fullName: input.fullName,
    roles: input.roles ?? ['ADMIN'],
    ...(input.categories
      ? { adminOperatorPermission: { categories: input.categories } }
      : {}),
  } as AdminUser;
}
