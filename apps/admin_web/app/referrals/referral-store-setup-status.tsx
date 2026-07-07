import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminTextLink } from '../../components/admin-text-link';
import { StatusBadge } from '../../components/status-badge';
import { referralStoreSetupState, type ReferralAudienceSlug } from '../../lib/referral-links';

export function ReferralStoreSetupStatus({ audience }: { readonly audience: ReferralAudienceSlug }) {
  const storeSetup = referralStoreSetupState(audience);
  const missingEnvKeys = referralStoreMissingEnvKeys(audience, storeSetup);
  const hasMissingSetup = missingEnvKeys.length > 0;

  return (
    <>
      <AdminFilterChipGroup ariaLabel="Referral store setup" className="admin-mt-8">
        <StatusBadge tone={storeSetup.publicBase ? 'success' : 'warning'}>
          Public link base {storeSetup.publicBase ? 'ready' : 'missing'}
        </StatusBadge>
        <StatusBadge tone={storeSetup.android ? 'success' : 'warning'}>
          Android store {storeSetup.android ? 'ready' : 'missing'}
        </StatusBadge>
        <StatusBadge tone={storeSetup.ios ? 'success' : 'warning'}>
          iOS store {storeSetup.ios ? 'ready' : 'missing'}
        </StatusBadge>
      </AdminFilterChipGroup>
      {hasMissingSetup ? (
        <>
          <p className="muted admin-mt-8">Missing setup: {missingEnvKeys.join(', ')}</p>
          <AdminTextLink className="admin-mt-8" href="/setup#referrals">
            Configure store URLs
          </AdminTextLink>
        </>
      ) : null}
    </>
  );
}

function referralStoreMissingEnvKeys(
  audience: ReferralAudienceSlug,
  storeSetup: ReturnType<typeof referralStoreSetupState>,
) {
  const audienceEnvName = audience === 'partner' ? 'PARTNER' : 'CUSTOMER';
  const missingEnvKeys: string[] = [];

  if (!storeSetup.publicBase) {
    missingEnvKeys.push('REFERRAL_PUBLIC_BASE_URL');
  }

  if (!storeSetup.android) {
    missingEnvKeys.push(`REFERRAL_${audienceEnvName}_ANDROID_STORE_URL`);
  }

  if (!storeSetup.ios) {
    missingEnvKeys.push(`REFERRAL_${audienceEnvName}_IOS_STORE_URL`);
  }

  return missingEnvKeys;
}
