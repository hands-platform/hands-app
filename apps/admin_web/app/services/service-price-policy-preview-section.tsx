import { AdminDataTable } from '../../components/admin-data-table';
import { formatMoney } from '../../lib/admin-format';
import type {
  ServicePricePolicyPreviewRow,
  ServicePricePolicyScenario,
} from '../../lib/service-price-policy-preview-rows';

type PricePolicyPreviewSummary = {
  readonly balancedStepCommission: number;
  readonly currency: string;
  readonly currentCommission: number;
  readonly customerStepCommission: number;
  readonly missingBaseRuleCount: number;
  readonly policyCheckCount: number;
  readonly providerStepCommission: number;
};

type ServicePricePolicyPreviewSectionProps = {
  readonly hiddenRowCount: number;
  readonly rows: readonly ServicePricePolicyPreviewRow[];
  readonly summary: PricePolicyPreviewSummary;
  readonly visibleRows: readonly ServicePricePolicyPreviewRow[];
};

const SERVICE_PRICE_POLICY_PREVIEW_HEADERS = [
  'Service option',
  'Current policy',
  'Customer + step',
  'Partner + step',
  'Both + step',
  'Check',
] as const;

export function ServicePricePolicyPreviewSection({
  hiddenRowCount,
  rows,
  summary,
  visibleRows,
}: ServicePricePolicyPreviewSectionProps) {
  return (
    <section className="card admin-card-scroll admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Price policy change preview</h2>
          <p className="muted">
            Before changing service prices, compare the current minimum price against common one-step
            scenarios. This helps avoid accidentally creating zero-margin prices or Partner payouts that
            create cash booking closeout problems.
          </p>
        </div>
        <span className={`pill ${summary.policyCheckCount ? 'pill-warn' : 'pill-success'}`}>
          {summary.policyCheckCount} policy check(s)
        </span>
      </div>
      <div className="service-trace-summary">
        <div>
          <span>Previewed options</span>
          <strong>{rows.length}</strong>
        </div>
        <div>
          <span>Current commission</span>
          <strong>{formatMoney(summary.currentCommission, summary.currency)}</strong>
        </div>
        <div>
          <span>Customer + step</span>
          <strong>{formatMoney(summary.customerStepCommission, summary.currency)}</strong>
        </div>
        <div>
          <span>Partner + step</span>
          <strong>{formatMoney(summary.providerStepCommission, summary.currency)}</strong>
        </div>
        <div>
          <span>Both + step</span>
          <strong>{formatMoney(summary.balancedStepCommission, summary.currency)}</strong>
        </div>
        <div>
          <span>Missing base rule</span>
          <strong>{summary.missingBaseRuleCount}</strong>
        </div>
      </div>
      {rows.length ? (
        <div className="admin-table-scroll">
          <AdminDataTable
            className="service-trace"
            emptyMessage={null}
            headers={SERVICE_PRICE_POLICY_PREVIEW_HEADERS}
            rowCount={visibleRows.length}
          >
            {visibleRows.map((row) => (
              <tr key={row.service.id}>
                <td>
                  <strong>{row.service.name}</strong>
                  <p className="muted">
                    {row.service.durationMin} min / step {formatMoney(row.priceStep, row.currency)}
                  </p>
                </td>
                <td>
                  {row.baseRule ? (
                    <div className="service-matrix-cell">
                      <strong>{formatMoney(row.baseRule.customerPrice, row.currency)}</strong>
                      <small>Partner {formatMoney(row.baseRule.providerPayoutAmount, row.currency)}</small>
                      <small>
                        Commission {formatMoney(row.currentFinance.actualCompanyCommission, row.currency)}
                      </small>
                    </div>
                  ) : (
                    <span className="pill pill-danger">Missing base payout</span>
                  )}
                </td>
                <td>
                  <ScenarioPreviewCell scenario={row.customerStepScenario} />
                </td>
                <td>
                  <ScenarioPreviewCell scenario={row.providerStepScenario} />
                </td>
                <td>
                  <ScenarioPreviewCell scenario={row.balancedStepScenario} />
                </td>
                <td>
                  <span className={`pill ${row.checkTone}`}>{row.checkLabel}</span>
                  <p className="muted">{row.nextAction}</p>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </div>
      ) : (
        <p className="muted">No active service option is available for price policy preview.</p>
      )}
      {hiddenRowCount ? (
        <p className="muted">
          Showing first {visibleRows.length} of {rows.length} preview row(s). Check summaries above still use
          the full active catalog.
        </p>
      ) : null}
    </section>
  );
}

function ScenarioPreviewCell({ scenario }: { readonly scenario: ServicePricePolicyScenario | null }) {
  if (!scenario) {
    return <span className="pill pill-danger">No base rule</span>;
  }

  return (
    <div className="service-matrix-cell">
      <span className={`pill ${scenario.tone}`}>{scenario.status}</span>
      <strong>{formatMoney(scenario.customerPrice, scenario.currency)}</strong>
      <small>Partner {formatMoney(scenario.providerPayoutAmount, scenario.currency)}</small>
      <small>Commission {formatMoney(scenario.finance.actualCompanyCommission, scenario.currency)}</small>
      <small>Tax {formatMoney(scenario.finance.withholdingAmount, scenario.currency)}</small>
    </div>
  );
}
