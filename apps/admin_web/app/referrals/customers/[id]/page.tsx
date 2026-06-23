import { notFound } from 'next/navigation';

import { type AdminCustomerReferralParent, adminGet } from '../../../../lib/admin-api';
import { ReferralParentDetailPage } from '../../referral-detail';

type PageProps = {
  readonly params: Promise<{ id: string }>;
};

export default async function CustomerReferralDetailPage({ params }: PageProps) {
  const { id } = await params;
  const row = await adminGet<AdminCustomerReferralParent | null>(
    `/admin/referrals/customers/${encodeURIComponent(id)}`,
    null,
  );
  if (!row) {
    notFound();
  }

  return <ReferralParentDetailPage audience="customer" row={row} />;
}
