import Link from 'next/link';
import { ActionMenu } from '../../components/action-menu';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { PillClassBadge } from '../../components/status-badge';
import { formatMoney } from '../../lib/admin-format';
import type { CashSettlementProviderGroup } from './cash-settlement-page-types';

type CashSettlementProviderGroupsSectionProps = {
  readonly providers: readonly CashSettlementProviderGroup[];
};

export function CashSettlementProviderGroupsSection({ providers }: CashSettlementProviderGroupsSectionProps) {
  return (
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
      description="Partner-level view for deciding whether to collect a direct deposit or approve an offset against later positive earnings."
      resultLabel={`${providers.length} partner(s)`}
      resultTone={providers.length > 0 ? 'warning' : 'success'}
      title="Partner wallet debt groups"
    >
      <div className="participant-list admin-mb-12">
        <Link className="text-link" href="/partner-controls">
          Partner controls
        </Link>
      </div>
      {providers.length ? (
        <div className="detail-grid admin-mt-16">
          {providers.map((provider) => (
            <div key={provider.providerProfileId}>
              <div className="ops-section-header">
                <h3>{provider.providerName}</h3>
                <PillClassBadge pillClass="pill-danger">
                  {formatMoney(provider.debtAmount, provider.currency)}
                </PillClassBadge>
              </div>
              <p className="muted">
                {provider.rowCount} open cash debt row(s), {formatMoney(provider.platformFee, provider.currency)} HANDS
                fee, {formatMoney(provider.taxAmount, provider.currency)} tax.
              </p>
              <div className="participant-list admin-mt-8">
                <ActionMenu
                  actions={[
                    {
                      href: `/partners/${provider.providerProfileId}`,
                      kind: 'link',
                      label: 'Partner',
                      tone: 'info',
                    },
                  ]}
                  label={`${provider.providerName} partner actions`}
                />
                <PillClassBadge pillClass="pill-warn">Suggested ref {provider.settlementReference}</PillClassBadge>
                <PillClassBadge pillClass="pill-info">{provider.oldestOpenLabel}</PillClassBadge>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <AdminEmptyState framed message="No Partner has open cash settlement debt." title={null} />
      )}
    </AdminFilterPanel>
  );
}
