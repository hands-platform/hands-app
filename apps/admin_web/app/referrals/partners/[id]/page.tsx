import { notFound } from 'next/navigation';

import { type AdminPartnerReferralParent, adminGet } from '../../../../lib/admin-api';
import { ReferralParentDetailPage } from '../../referral-detail';

type PageProps = {
  readonly params: Promise<{ id: string }>;
};

export default async function PartnerReferralDetailPage({ params }: PageProps) {
  const { id } = await params;
  const row = await adminGet<AdminPartnerReferralParent | null>(
    `/admin/referrals/partners/${encodeURIComponent(id)}`,
    null,
  );
  if (!row) {
    notFound();
  }

  return <ReferralParentDetailPage audience="partner" row={row} />;
}
