import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
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
      <div className="ops-section-header">
        <div>
          <h2>Service price readiness</h2>
          <p className="muted">
            Customer apps only show options with an active partner service and an exact active payout rule.
          </p>
        </div>
        <span className={`pill ${readyCount ? 'pill-success' : 'pill-warn'}`}>
          {`${readyCount}/${rows.length} bookable`}
        </span>
      </div>
      <AdminTableScroll>
        <AdminDataTable
          emptyMessage={<ServicePricingEmptyState />}
          headers={servicePricingHeaders}
          rowCount={rows.length}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.name}</strong>
                <div className="participant-list admin-mt-6">
                  <span className="pill pill-info">{row.durationLabel}</span>
                  <span className="pill pill-info">{row.payoutRuleLabel}</span>
                </div>
              </td>
              <td>
                <strong>{row.priceLine}</strong>
              </td>
              <td>
                <span className={`pill ${row.bookable ? 'pill-success' : 'pill-warn'}`}>
                  {row.bookable ? 'CUSTOMER VISIBLE' : 'HIDDEN'}
                </span>
              </td>
              <td>
                <span className="muted">{marketplaceDisplayText(row.issue)}</span>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </div>
  );
}

const servicePricingHeaders = ['Service', 'Pricing', 'Visibility', 'Issue'] as const;

function ServicePricingEmptyState() {
  return (
    <>
      <strong>No service pricing found</strong>
      <p className="muted">No partner service prices are connected yet.</p>
    </>
  );
}
