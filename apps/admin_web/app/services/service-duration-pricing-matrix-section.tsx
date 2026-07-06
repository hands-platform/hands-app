import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminTableSection } from '../../components/admin-table-panel';
import { MoneyText } from '../../components/money-text';
import { StatusBadge } from '../../components/status-badge';
import type { AdminServiceCatalogItem, AdminTaxPolicyVersion } from '../../lib/admin-api';
import { serviceBasePayoutRule as basePayoutRule } from '../../lib/service-base-payout-rule';
import type { ServiceCatalogGroup } from '../../lib/service-catalog-filters';
import { serviceDurationMatrix } from '../../lib/service-duration-matrix';
import { servicePayoutFinance } from '../../lib/service-payout-finance';

type ServicePayoutRule = NonNullable<AdminServiceCatalogItem['payoutRules']>[number];

type ServiceDurationPricingMatrixSectionProps = {
  readonly activeTaxPolicy: AdminTaxPolicyVersion | undefined;
  readonly hiddenGroupCount: number;
  readonly totalGroupCount: number;
  readonly visibleGroups: readonly ServiceCatalogGroup[];
};

const SERVICE_MATRIX_DURATIONS = [60, 90, 120] as const;
const SERVICE_DURATION_PRICING_MATRIX_HEADERS = [
  'Service',
  '60 min',
  '90 min',
  '120 min',
  'Policy state',
] as const;

export function ServiceDurationPricingMatrixSection({
  activeTaxPolicy,
  hiddenGroupCount,
  totalGroupCount,
  visibleGroups,
}: ServiceDurationPricingMatrixSectionProps) {
  return (
    <AdminTableSection
      bodyClassName="admin-table-section-body"
      className="admin-mb-16"
      description="One row is one service name. Each duration cell shows customer minimum, Partner payout, and projected company commission after VAT, withholding, and other configured costs."
      scrollable
      statusLabel={`${SERVICE_MATRIX_DURATIONS.join(' / ')} min`}
      statusTone="info"
      title="Duration pricing matrix"
    >
      <AdminTableScroll>
        <AdminDataTable
          className="service-matrix"
          emptyMessage={null}
          headers={SERVICE_DURATION_PRICING_MATRIX_HEADERS}
          rowCount={visibleGroups.length}
        >
          {visibleGroups.map((group) => {
            const matrix = serviceDurationMatrix({
              activeTaxPolicy,
              basePayoutRule,
              items: group.items,
              servicePayoutFinance,
            });

            return (
              <tr key={group.key}>
                <td>
                  <strong>{group.label}</strong>
                  <p className="muted">{group.key}</p>
                </td>
                {SERVICE_MATRIX_DURATIONS.map((duration) => (
                  <ServiceDurationCell
                    cell={matrix.byDuration.get(duration)}
                    key={`${group.key}-${duration}`}
                  />
                ))}
                <td>
                  <div className="service-matrix-cell">
                    <StatusBadge tone={matrix.blockedCount ? 'danger' : 'success'}>
                      {matrix.blockedCount ? `${matrix.blockedCount} blocked` : 'Bookable'}
                    </StatusBadge>
                    <small>{matrix.activeCount} active duration option(s)</small>
                    <small>{matrix.payoutRuleCount} payout rule(s)</small>
                    <small>
                      Customer minimum total{' '}
                      <MoneyText amount={matrix.totals.customerMinimum} currency={matrix.totals.currency} />
                    </small>
                    <small>
                      Partner payout total{' '}
                      <MoneyText amount={matrix.totals.providerPayout} currency={matrix.totals.currency} />
                    </small>
                    <small>
                      Gross HANDS fee total{' '}
                      <MoneyText amount={matrix.totals.grossFee} currency={matrix.totals.currency} />
                    </small>
                    <small>
                      Tax / cost total{' '}
                      <MoneyText amount={matrix.totals.taxAndCost} currency={matrix.totals.currency} />
                    </small>
                    <small>
                      Net company fee total{' '}
                      <MoneyText amount={matrix.totals.netCompanyFee} currency={matrix.totals.currency} />
                    </small>
                  </div>
                </td>
              </tr>
            );
          })}
        </AdminDataTable>
      </AdminTableScroll>
      {hiddenGroupCount ? (
        <p className="muted">
          Showing first {visibleGroups.length} of {totalGroupCount} service type(s) to keep the operations
          page responsive. Full totals above still use the complete catalog.
        </p>
      ) : null}
    </AdminTableSection>
  );
}

type DurationMatrixCell =
  | {
      readonly baseRule: ServicePayoutRule | null;
      readonly finance: {
        readonly actualCompanyCommission: number;
        readonly fee: number;
        readonly taxRuleLabel: string | null;
        readonly vatAmount: number;
        readonly withholdingAmount: number;
      };
      readonly service: AdminServiceCatalogItem;
    }
  | undefined;

function ServiceDurationCell({ cell }: { readonly cell: DurationMatrixCell }) {
  if (!cell) {
    return (
      <td>
        <StatusBadge tone="neutral">Not configured</StatusBadge>
      </td>
    );
  }

  const cellCurrency = cell.baseRule?.currency ?? 'VND';
  const cellTaxAndCost = cell.baseRule
    ? cell.finance.vatAmount + cell.finance.withholdingAmount + cell.baseRule.otherCostAmount
    : 0;

  return (
    <td>
      <div className="service-matrix-cell">
        <strong>
          Customer <MoneyText amount={cell.service.basePrice} currency={cellCurrency} />
        </strong>
        <StatusBadge tone={cell.baseRule ? 'success' : 'danger'}>
          {cell.baseRule ? 'Payout ready' : 'Payout missing'}
        </StatusBadge>
        <small>
          Partner{' '}
          {cell.baseRule ? (
            <MoneyText amount={cell.baseRule.providerPayoutAmount} currency={cell.baseRule.currency} />
          ) : (
            'not set'
          )}
        </small>
        <small>
          Gross HANDS fee{' '}
          {cell.baseRule ? <MoneyText amount={cell.finance.fee} currency={cellCurrency} /> : '-'}
        </small>
        <small>
          VAT / withholding / cost{' '}
          {cell.baseRule ? <MoneyText amount={cellTaxAndCost} currency={cellCurrency} /> : '-'}
        </small>
        <small>
          Net company fee{' '}
          {cell.baseRule ? (
            <MoneyText amount={cell.finance.actualCompanyCommission} currency={cellCurrency} />
          ) : (
            '-'
          )}
        </small>
      </div>
    </td>
  );
}
