import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminSection } from '../../components/admin-surface';
import { PillClassBadge, StatusBadge } from '../../components/status-badge';
import { formatMoney } from '../../lib/admin-format';
import type { ServicePayoutLedgerRow } from '../../lib/service-payout-ledger-rows';
import { slugify } from '../../lib/service-catalog-filters';

type ServicePayoutLedgerSectionProps = {
  readonly activeServiceCount: number;
  readonly hiddenRowCount: number;
  readonly rows: readonly ServicePayoutLedgerRow[];
  readonly visibleRows: readonly ServicePayoutLedgerRow[];
};

const SERVICE_PAYOUT_LEDGER_HEADERS = [
  'Service option',
  'Customer price',
  'Partner payout',
  'Gross fee',
  'Tax / cost',
  'Actual company commission',
  'Partner visibility',
  'Next action',
] as const;

export function ServicePayoutLedgerSection({
  activeServiceCount,
  hiddenRowCount,
  rows,
  visibleRows,
}: ServicePayoutLedgerSectionProps) {
  return (
    <AdminSection
      bodyClassName="admin-table-section-body"
      className="admin-card-scroll admin-mb-16 vuexy-booking-table-card vuexy-booking-table-group"
      description="Finance view for the current minimum price of every active duration option. This is the fastest way to confirm customer price, Partner payout, tax/cost assumptions, and customer-app visibility before Partners start selling."
      statusLabel={`${activeServiceCount} active option(s)`}
      statusTone="info"
      title="Service payout ledger"
    >
      <AdminTableScroll>
        <AdminDataTable
          className="service-ledger"
          emptyMessage={null}
          headers={SERVICE_PAYOUT_LEDGER_HEADERS}
          rowCount={visibleRows.length}
        >
          {visibleRows.map((row) => (
            <tr key={row.service.id}>
              <td>
                <strong>{row.service.name}</strong>
                <p className="muted">
                  {row.service.durationMin} min / {row.service.serviceGroupKey ?? slugify(row.service.name)}
                </p>
              </td>
              <td>{formatMoney(row.service.basePrice, row.currency)}</td>
              <td>{row.baseRule ? formatMoney(row.baseRule.providerPayoutAmount, row.currency) : '-'}</td>
              <td>{row.baseRule ? formatMoney(row.finance.fee, row.currency) : '-'}</td>
              <td>
                {row.baseRule ? (
                  <div className="service-matrix-cell">
                    <small>VAT {formatMoney(row.finance.vatAmount, row.currency)}</small>
                    <small>Withholding {formatMoney(row.finance.withholdingAmount, row.currency)}</small>
                    <small>Other {formatMoney(row.baseRule.otherCostAmount, row.currency)}</small>
                  </div>
                ) : (
                  '-'
                )}
              </td>
              <td>
                <PillClassBadge pillClass={row.commissionTone}>
                  {row.baseRule ? formatMoney(row.finance.actualCompanyCommission, row.currency) : 'Missing rule'}
                </PillClassBadge>
              </td>
              <td>
                <div className="service-matrix-cell">
                  <StatusBadge tone={row.hiddenProviders ? 'warning' : 'success'}>
                    {row.visibleProviders} visible / {row.hiddenProviders} hidden
                  </StatusBadge>
                  <small>{row.totalProviderRows} Partner price row(s)</small>
                </div>
              </td>
              <td>
                <PillClassBadge pillClass={row.actionTone}>{row.action}</PillClassBadge>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      {hiddenRowCount ? (
        <p className="muted">
          Showing first {visibleRows.length} of {rows.length} active option(s). Full finance totals still
          include every active option.
        </p>
      ) : null}
    </AdminSection>
  );
}
