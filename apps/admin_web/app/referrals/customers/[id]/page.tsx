import { notFound } from 'next/navigation';

import { canViewAdminDeveloperSystem } from '../../../../components/admin-developer-system-section';
import { type AdminCustomerReferralParent, type AdminUser, adminGet } from '../../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../../lib/admin-operator-access';
import { buildFinanceApproverOptions } from '../../../finance-tax/finance-approver-options';
import { ReferralParentDetailPage, referralParentNeedsFinanceApprover } from '../../referral-detail';

type PageProps = {
  readonly params: Promise<{ id: string }>;
};

export default async function CustomerReferralDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [operatorAccess, row] = await Promise.all([
    getCurrentAdminOperatorAccess(),
    adminGet<AdminCustomerReferralParent | null>(`/admin/referrals/customers/${encodeURIComponent(id)}`, null),
  ]);
  if (!row) {
    notFound();
  }
  const financeApproverUsers = referralParentNeedsFinanceApprover(row)
    ? await adminGet<AdminUser[]>('/admin/users?take=50&role=ADMIN&view=finance-approver-directory', [])
    : [];
  const financeApproverOptions = buildFinanceApproverOptions(financeApproverUsers, operatorAccess?.id ?? null);

  return (
    <ReferralParentDetailPage
      audience="customer"
      canViewDeveloperSetup={canViewAdminDeveloperSystem(operatorAccess)}
      financeApproverOptions={financeApproverOptions}
      row={row}
    />
  );
}
