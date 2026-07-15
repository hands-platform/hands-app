import type { AdminUser } from '../../lib/admin-api';

export type FinanceApproverOption = {
  readonly label: string;
  readonly value: string;
};

export function buildFinanceApproverOptions(
  users: readonly AdminUser[],
  currentOperatorId: string | null,
): FinanceApproverOption[] {
  return users
    .filter((user) => user.roles.includes('FINANCE_APPROVER'))
    .filter((user) => user.id !== currentOperatorId)
    .sort((left, right) => financeApproverLabel(left).localeCompare(financeApproverLabel(right)))
    .map((user) => ({ label: financeApproverLabel(user), value: user.id }));
}

function financeApproverLabel(user: AdminUser) {
  const identity = user.email ?? user.phone ?? user.id;
  return user.fullName && user.fullName !== identity ? `${user.fullName} · ${identity}` : identity;
}
