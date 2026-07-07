import { ActionMenu } from '../../components/action-menu';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminSectionHeader } from '../../components/admin-page-template';
import { AdminDetailGrid } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { MoneyText } from '../../components/money-text';
import { StatusBadge } from '../../components/status-badge';
import type { CashSettlementProviderGroup } from './cash-settlement-page-types';

type CashSettlementProviderGroupsSectionProps = {
  readonly providers: readonly CashSettlementProviderGroup[];
};

export function CashSettlementProviderGroupsSection({ providers }: CashSettlementProviderGroupsSectionProps) {
  return (
    <AdminTablePanel
      description="Partner-level view for deciding whether to collect a direct deposit or approve an offset against later positive earnings."
      resultLabel={`${providers.length} partner(s)`}
      resultTone={providers.length > 0 ? 'warning' : 'success'}
      title="Partner wallet debt groups"
    >
      <AdminFilterChipGroup ariaLabel="Partner wallet debt links" className="admin-mb-12">
        <AdminTextLink href="/partner-controls">
          Partner controls
        </AdminTextLink>
      </AdminFilterChipGroup>
      {providers.length ? (
        <AdminDetailGrid className="admin-mt-16">
          {providers.map((provider) => (
            <div key={provider.providerProfileId}>
              <AdminSectionHeader
                status={
                  <StatusBadge tone="danger">
                    <MoneyText amount={provider.debtAmount} currency={provider.currency} />
                  </StatusBadge>
                }
                title={provider.providerName}
              />
              <p className="muted">
                {provider.rowCount} open cash debt row(s),{' '}
                <MoneyText amount={provider.platformFee} currency={provider.currency} /> HANDS fee,{' '}
                <MoneyText amount={provider.taxAmount} currency={provider.currency} /> tax.
              </p>
              <AdminFilterChipGroup ariaLabel={`${provider.providerName} debt group actions`} className="admin-mt-8">
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
                <StatusBadge tone="warning">Suggested ref {provider.settlementReference}</StatusBadge>
                <StatusBadge tone="info">{provider.oldestOpenLabel}</StatusBadge>
              </AdminFilterChipGroup>
            </div>
          ))}
        </AdminDetailGrid>
      ) : (
        <AdminEmptyState framed message="No Partner has open cash settlement debt." title={null} />
      )}
    </AdminTablePanel>
  );
}
