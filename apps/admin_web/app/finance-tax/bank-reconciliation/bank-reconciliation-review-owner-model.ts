import type { AdminUser } from '../../../lib/admin-api';

export function buildBankReconciliationReviewOwnerOptions(
  users: readonly AdminUser[],
  currentOwnerId: string | null,
  currentOperatorId: string | null,
) {
  return buildFinanceReviewOwnerOptions(
    users,
    currentOwnerId,
    currentOperatorId,
    'FINANCE_BANK_RECONCILIATION',
  );
}

export function buildPaymentClearingReviewOwnerOptions(
  users: readonly AdminUser[],
  currentOwnerId: string | null,
  currentOperatorId: string | null,
) {
  return buildFinanceReviewOwnerOptions(
    users,
    currentOwnerId,
    currentOperatorId,
    'FINANCE_PAYMENT_CLEARING',
  );
}

function buildFinanceReviewOwnerOptions(
  users: readonly AdminUser[],
  currentOwnerId: string | null,
  currentOperatorId: string | null,
  requiredCategory: 'FINANCE_BANK_RECONCILIATION' | 'FINANCE_PAYMENT_CLEARING',
) {
  return users
    .filter((user) => hasFinanceAssignmentAccess(user, requiredCategory))
    .filter((user) => user.id !== currentOwnerId)
    .sort((left, right) => {
      const currentOperatorDelta =
        Number(right.id === currentOperatorId) - Number(left.id === currentOperatorId);
      if (currentOperatorDelta !== 0) return currentOperatorDelta;
      return adminUserOptionLabel(left).localeCompare(adminUserOptionLabel(right));
    })
    .map((user) => ({ label: adminUserOptionLabel(user), value: user.id }));
}

function hasFinanceAssignmentAccess(
  user: AdminUser,
  requiredCategory: 'FINANCE_BANK_RECONCILIATION' | 'FINANCE_PAYMENT_CLEARING',
) {
  const roles = user.roles ?? [];
  return roles.includes('MASTER_ADMIN') ||
    Boolean(user.adminOperatorPermission?.categories.includes(requiredCategory)) ||
    (!user.adminOperatorPermission && roles.includes('FINANCE_APPROVER'));
}

function adminUserOptionLabel(user: AdminUser) {
  const identity = user.email ?? user.phone ?? user.id;
  return user.fullName && user.fullName !== identity ? `${user.fullName} · ${identity}` : identity;
}
