import type { AdminUser } from '../../../lib/admin-api';

export function buildBankReconciliationReviewOwnerOptions(
  users: readonly AdminUser[],
  currentOwnerId: string | null,
  currentOperatorId: string | null,
) {
  return users
    .filter(hasBankReconciliationAssignmentAccess)
    .filter((user) => user.id !== currentOwnerId)
    .sort((left, right) => {
      const currentOperatorDelta =
        Number(right.id === currentOperatorId) - Number(left.id === currentOperatorId);
      if (currentOperatorDelta !== 0) return currentOperatorDelta;
      return adminUserOptionLabel(left).localeCompare(adminUserOptionLabel(right));
    })
    .map((user) => ({ label: adminUserOptionLabel(user), value: user.id }));
}

function hasBankReconciliationAssignmentAccess(user: AdminUser) {
  const roles = user.roles ?? [];
  return roles.includes('MASTER_ADMIN') ||
    Boolean(user.adminOperatorPermission?.categories.includes('FINANCE_BANK_RECONCILIATION')) ||
    (!user.adminOperatorPermission && roles.includes('FINANCE_APPROVER'));
}

function adminUserOptionLabel(user: AdminUser) {
  const identity = user.email ?? user.phone ?? user.id;
  return user.fullName && user.fullName !== identity ? `${user.fullName} · ${identity}` : identity;
}
