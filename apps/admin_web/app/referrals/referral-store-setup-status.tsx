import Link from 'next/link';

import { StatusBadge } from '../../components/status-badge';
import { referralStoreSetupState, type ReferralAudienceSlug } from '../../lib/referral-links';

export function ReferralStoreSetupStatus({ audience }: { readonly audience: ReferralAudienceSlug }) {
  const storeSetup = referralStoreSetupState(audience);
  const hasMissingSetup = !storeSetup.publicBase || !storeSetup.android || !storeSetup.ios;

  return (
    <>
      <div className="participant-list admin-mt-8" aria-label="Referral store setup">
        <StatusBadge tone={storeSetup.publicBase ? 'success' : 'warning'}>
          Public link base {storeSetup.publicBase ? 'ready' : 'missing'}
        </StatusBadge>
        <StatusBadge tone={storeSetup.android ? 'success' : 'warning'}>
          Android store {storeSetup.android ? 'ready' : 'missing'}
        </StatusBadge>
        <StatusBadge tone={storeSetup.ios ? 'success' : 'warning'}>
          iOS store {storeSetup.ios ? 'ready' : 'missing'}
        </StatusBadge>
      </div>
      {hasMissingSetup ? (
        <Link className="text-link admin-mt-8" href="/setup#referrals">
          Configure store URLs
        </Link>
      ) : null}
    </>
  );
}
