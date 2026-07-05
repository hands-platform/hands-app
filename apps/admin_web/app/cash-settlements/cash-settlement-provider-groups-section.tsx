import Link from 'next/link';
import { ActionMenu } from '../../components/action-menu';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminSectionHeader } from '../../components/admin-page-template';
import { AdminDetailGrid } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
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
      <div className="participant-list admin-mb-12">
        <Link className="text-link" href="/partner-controls">
          Partner controls
        </Link>
      </div>
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
                <StatusBadge tone="warning">Suggested ref {provider.settlementReference}</StatusBadge>
                <StatusBadge tone="info">{provider.oldestOpenLabel}</StatusBadge>
              </div>
            </div>
          ))}
        </AdminDetailGrid>
      ) : (
        <AdminEmptyState framed message="No Partner has open cash settlement debt." title={null} />
      )}
    </AdminTablePanel>
  );
}
