import { notFound } from 'next/navigation';

import { canViewAdminDeveloperSystem } from '../../../../components/admin-developer-system-section';
import { type AdminCustomerReferralParent, adminGet } from '../../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../../lib/admin-operator-access';
import { ReferralParentDetailPage } from '../../referral-detail';

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

  return (
    <ReferralParentDetailPage
      audience="customer"
      canViewDeveloperSetup={canViewAdminDeveloperSystem(operatorAccess)}
      row={row}
    />
  );
}
