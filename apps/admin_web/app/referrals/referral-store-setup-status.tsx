import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminTextLink } from '../../components/admin-text-link';
import { StatusBadge } from '../../components/status-badge';
import { referralStoreSetupState, type ReferralAudienceSlug } from '../../lib/referral-links';

export function ReferralStoreSetupStatus({
  audience,
  canViewDeveloperSetup = false,
}: {
  readonly audience: ReferralAudienceSlug;
  readonly canViewDeveloperSetup?: boolean;
}) {
  const storeSetup = referralStoreSetupState(audience);
  const hasMissingSetup = !storeSetup.publicBase || !storeSetup.android || !storeSetup.ios;

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
          <p className="muted admin-mt-8">One or more required public or store destinations are not configured.</p>
          {canViewDeveloperSetup ? (
            <AdminTextLink className="admin-mt-8" href="/setup#referrals">
              Open Developer setup
            </AdminTextLink>
          ) : null}
        </>
      ) : null}
    </>
  );
}
