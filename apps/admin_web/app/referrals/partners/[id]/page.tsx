import { notFound } from 'next/navigation';

import { canViewAdminDeveloperSystem } from '../../../../components/admin-developer-system-section';
import { type AdminPartnerReferralParent, adminGet } from '../../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../../lib/admin-operator-access';
import { hasAdminOperatorCategory } from '../../../../lib/admin-operator-access-model';
import { ReferralParentDetailPage } from '../../referral-detail';

type PageProps = {
  readonly params: Promise<{ id: string }>;
};

export default async function PartnerReferralDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [operatorAccess, row] = await Promise.all([
    getCurrentAdminOperatorAccess(),
    adminGet<AdminPartnerReferralParent | null>(`/admin/referrals/partners/${encodeURIComponent(id)}`, null),
  ]);
  if (!row) {
    notFound();
  }
  return (
    <ReferralParentDetailPage
      audience="partner"
      canReviewTax={hasAdminOperatorCategory(operatorAccess, 'FINANCE_TAX')}
      canViewDeveloperSetup={canViewAdminDeveloperSystem(operatorAccess)}
      row={row}
    />
  );
}
