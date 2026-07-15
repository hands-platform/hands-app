import type { AdminUser } from '../../lib/admin-api';
import { buildFinanceApproverOptions } from './finance-approver-options';

describe('finance approver options', () => {
  it('keeps only other Finance approvers and provides human-readable labels', () => {
    const users = [
      adminUser('operator-1', ['ADMIN', 'FINANCE_APPROVER'], 'Current Operator', 'current@example.com'),
      adminUser('approver-2', ['ADMIN', 'FINANCE_APPROVER'], 'Finance Approver', 'approver@example.com'),
      adminUser('admin-3', ['ADMIN'], 'Operations Admin', 'ops@example.com'),
    ];

    expect(buildFinanceApproverOptions(users, 'operator-1')).toEqual([
      { label: 'Finance Approver · approver@example.com', value: 'approver-2' },
    ]);
  });
});

function adminUser(id: string, roles: string[], fullName: string, email: string): AdminUser {
  return { email, fullName, id, phone: '', roles };
}
