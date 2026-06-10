import Link from 'next/link';
import { formatMoney } from '../../lib/admin-format';
import type { CashSettlementProviderGroup } from './cash-settlement-page-types';

type CashSettlementProviderGroupsSectionProps = {
  readonly providers: readonly CashSettlementProviderGroup[];
};

export function CashSettlementProviderGroupsSection({ providers }: CashSettlementProviderGroupsSectionProps) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="ops-section-header">
        <div>
          <h2>Partner wallet debt groups</h2>
          <p className="muted">
            Partner-level view for deciding whether to collect a direct deposit or approve an offset against later
            positive earnings.
          </p>
        </div>
        <Link className="text-link" href="/partner-controls">
          Partner controls
        </Link>
      </div>
      {providers.length ? (
        <div className="detail-grid" style={{ marginTop: 16 }}>
          {providers.map((provider) => (
            <div key={provider.providerProfileId}>
              <div className="ops-section-header">
                <h3>{provider.providerName}</h3>
                <span className="pill pill-danger">{formatMoney(provider.debtAmount, provider.currency)}</span>
              </div>
              <p className="muted">
                {provider.rowCount} open cash debt row(s), {formatMoney(provider.platformFee, provider.currency)} HANDS
                fee, {formatMoney(provider.taxAmount, provider.currency)} tax.
              </p>
              <div className="participant-list" style={{ marginTop: 8 }}>
                <Link className="pill" href={`/partners/${provider.providerProfileId}`}>
                  Partner
                </Link>
                <span className="pill pill-warn">Suggested ref {provider.settlementReference}</span>
                <span className="pill pill-info">{provider.oldestOpenLabel}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No partner has open cash settlement debt.</p>
      )}
    </div>
  );
}
