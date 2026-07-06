import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminTableSection } from '../../components/admin-table-panel';
import { MoneyText } from '../../components/money-text';
import { StatusBadge, statusBadgeToneFromPillClass } from '../../components/status-badge';
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
    <AdminTableSection
      className="admin-mb-16"
      description="Before changing service prices, compare the current minimum price against common one-step scenarios. This helps avoid accidentally creating zero-margin prices or Partner payouts that create cash booking closeout problems."
      scrollable
      statusLabel={`${summary.policyCheckCount} policy check(s)`}
      statusTone={summary.policyCheckCount ? 'warning' : 'success'}
      title="Price policy change preview"
    >
      <AdminTraceSummary
        metrics={[
          { label: 'Previewed options', value: rows.length },
          {
            label: 'Current commission',
            value: <MoneyText amount={summary.currentCommission} currency={summary.currency} />,
          },
          {
            label: 'Customer + step',
            value: <MoneyText amount={summary.customerStepCommission} currency={summary.currency} />,
          },
          {
            label: 'Partner + step',
            value: <MoneyText amount={summary.providerStepCommission} currency={summary.currency} />,
          },
          {
            label: 'Both + step',
            value: <MoneyText amount={summary.balancedStepCommission} currency={summary.currency} />,
          },
          { label: 'Missing base rule', value: summary.missingBaseRuleCount },
        ]}
      />
      {rows.length ? (
        <AdminTableScroll>
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
                    {row.service.durationMin} min / step{' '}
                    <MoneyText amount={row.priceStep} currency={row.currency} />
                  </p>
                </td>
                <td>
                  {row.baseRule ? (
                    <div className="service-matrix-cell">
                      <strong>
                        <MoneyText amount={row.baseRule.customerPrice} currency={row.currency} />
                      </strong>
                      <small>
                        Partner{' '}
                        <MoneyText amount={row.baseRule.providerPayoutAmount} currency={row.currency} />
                      </small>
                      <small>
                        Commission{' '}
                        <MoneyText
                          amount={row.currentFinance.actualCompanyCommission}
                          currency={row.currency}
                        />
                      </small>
                    </div>
                  ) : (
                    <StatusBadge tone="danger">Missing base payout</StatusBadge>
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
                  <StatusBadge tone={statusBadgeToneFromPillClass(row.checkTone)}>
                    {row.checkLabel}
                  </StatusBadge>
                  <p className="muted">{row.nextAction}</p>
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      ) : (
        <AdminEmptyState framed message="No active service option is available for price policy preview." />
      )}
      {hiddenRowCount ? (
        <p className="muted">
          Showing first {visibleRows.length} of {rows.length} preview row(s). Check summaries above still use
          the full active catalog.
        </p>
      ) : null}
    </AdminTableSection>
  );
}

function ScenarioPreviewCell({ scenario }: { readonly scenario: ServicePricePolicyScenario | null }) {
  if (!scenario) {
    return <StatusBadge tone="danger">No base rule</StatusBadge>;
  }

  return (
    <div className="service-matrix-cell">
      <StatusBadge tone={statusBadgeToneFromPillClass(scenario.tone)}>{scenario.status}</StatusBadge>
      <strong>
        <MoneyText amount={scenario.customerPrice} currency={scenario.currency} />
      </strong>
      <small>
        Partner <MoneyText amount={scenario.providerPayoutAmount} currency={scenario.currency} />
      </small>
      <small>
        Commission{' '}
        <MoneyText amount={scenario.finance.actualCompanyCommission} currency={scenario.currency} />
      </small>
      <small>
        Tax <MoneyText amount={scenario.finance.withholdingAmount} currency={scenario.currency} />
      </small>
    </div>
  );
}
