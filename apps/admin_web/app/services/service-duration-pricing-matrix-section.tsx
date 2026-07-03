import { AdminDataTable } from '../../components/admin-data-table';
import { AdminSection } from '../../components/admin-surface';
import type { AdminServiceCatalogItem, AdminTaxPolicyVersion } from '../../lib/admin-api';
import { formatMoney } from '../../lib/admin-format';
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
    <AdminSection
      bodyClassName="admin-table-section-body"
      className="admin-card-scroll admin-mb-16"
      description="One row is one service name. Each duration cell shows customer minimum, Partner payout, and projected company commission after VAT, withholding, and other configured costs."
      statusLabel={`${SERVICE_MATRIX_DURATIONS.join(' / ')} min`}
      statusTone="info"
      title="Duration pricing matrix"
    >
      <div className="admin-table-scroll">
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
                    <span className={`pill ${matrix.blockedCount ? 'pill-danger' : 'pill-success'}`}>
                      {matrix.blockedCount ? `${matrix.blockedCount} blocked` : 'Bookable'}
                    </span>
                    <small>{matrix.activeCount} active duration option(s)</small>
                    <small>{matrix.payoutRuleCount} payout rule(s)</small>
                    <small>
                      Customer minimum total{' '}
                      {formatMoney(matrix.totals.customerMinimum, matrix.totals.currency)}
                    </small>
                    <small>
                      Partner payout total {formatMoney(matrix.totals.providerPayout, matrix.totals.currency)}
                    </small>
                    <small>
                      Gross HANDS fee total {formatMoney(matrix.totals.grossFee, matrix.totals.currency)}
                    </small>
                    <small>
                      Tax / cost total {formatMoney(matrix.totals.taxAndCost, matrix.totals.currency)}
                    </small>
                    <small>
                      Net company fee total {formatMoney(matrix.totals.netCompanyFee, matrix.totals.currency)}
                    </small>
                  </div>
                </td>
              </tr>
            );
          })}
        </AdminDataTable>
      </div>
      {hiddenGroupCount ? (
        <p className="muted">
          Showing first {visibleGroups.length} of {totalGroupCount} service type(s) to keep the operations
          page responsive. Full totals above still use the complete catalog.
        </p>
      ) : null}
    </AdminSection>
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
        <span className="pill pill-neutral">Not configured</span>
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
        <strong>Customer {formatMoney(cell.service.basePrice, cellCurrency)}</strong>
        <span className={cell.baseRule ? 'pill pill-success' : 'pill pill-danger'}>
          {cell.baseRule ? 'Payout ready' : 'Payout missing'}
        </span>
        <small>
          Partner{' '}
          {cell.baseRule
            ? formatMoney(cell.baseRule.providerPayoutAmount, cell.baseRule.currency)
            : 'not set'}
        </small>
        <small>Gross HANDS fee {cell.baseRule ? formatMoney(cell.finance.fee, cellCurrency) : '-'}</small>
        <small>
          VAT / withholding / cost {cell.baseRule ? formatMoney(cellTaxAndCost, cellCurrency) : '-'}
        </small>
        <small>
          Net company fee{' '}
          {cell.baseRule ? formatMoney(cell.finance.actualCompanyCommission, cellCurrency) : '-'}
        </small>
      </div>
    </td>
  );
}
