import { marketplaceDisplayText } from '../../../lib/admin-copy';

export type PartnerServicePricingDisplayRow = {
  readonly bookable: boolean;
  readonly durationLabel: string;
  readonly id: string;
  readonly issue: string;
  readonly name: string;
  readonly payoutRuleLabel: string;
  readonly priceLine: string;
};

type PartnerDetailServicePricingSectionProps = {
  readonly readyCount: number;
  readonly rows: readonly PartnerServicePricingDisplayRow[];
};

export function PartnerDetailServicePricingSection({
  readyCount,
  rows,
}: PartnerDetailServicePricingSectionProps) {
  return (
    <div className="card" id="service-pricing">
      <h2>Service price readiness</h2>
      <p className="muted">
        Customer apps only show options with an active partner service and an exact active payout rule.
      </p>
      <InfoLine label="Bookable options" value={`${readyCount}/${rows.length}`} />
      {rows.length ? (
        <div className="provider-file-list">
          {rows.map((row) => (
            <div className="provider-file-row" key={row.id}>
              <div className="participant-list admin-mb-6">
                <span className={`pill ${row.bookable ? 'pill-success' : 'pill-warn'}`}>
                  {row.bookable ? 'CUSTOMER VISIBLE' : 'HIDDEN'}
                </span>
                <span className="pill pill-info">{row.durationLabel}</span>
                <span className="pill pill-info">{row.payoutRuleLabel}</span>
              </div>
              <p>
                <strong>{row.name}</strong>
              </p>
              <p className="muted">{row.priceLine}</p>
              <p className="muted">{row.issue}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No partner service prices are connected yet.</p>
      )}
    </div>
  );
}

function InfoLine({ label, value }: { readonly label: string; readonly value?: string | null }) {
  return (
    <p className="muted">
      <strong>{label}:</strong> {value && value.trim() ? marketplaceDisplayText(value) : 'Missing'}
    </p>
  );
}
