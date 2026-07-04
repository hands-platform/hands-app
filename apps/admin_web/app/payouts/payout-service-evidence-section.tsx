import { formatMoney } from '../../lib/admin-format';
import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { StatusBadge } from '../../components/status-badge';

export type PayoutServiceEvidenceItem = {
  readonly batchCount: number;
  readonly cashDebtAmount: number;
  readonly currency: string;
  readonly earningCount: number;
  readonly grossAmount: number;
  readonly groupKey: string;
  readonly key: string;
  readonly label: string;
  readonly netAmount: number;
  readonly platformFee: number;
  readonly withholdingAmount: number;
};

type PayoutServiceEvidenceSectionProps = {
  readonly batchCount: number;
  readonly currency: string;
  readonly items: readonly PayoutServiceEvidenceItem[];
};

export function PayoutServiceEvidenceSection({
  batchCount,
  currency,
  items,
}: PayoutServiceEvidenceSectionProps) {
  return (
    <AdminFilterPanel
      className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
      description="Shows which service duration options are inside payout batches, so finance can reconcile partner net, HANDS fee, tax withholding, and cash wallet debt before bank transfer."
      resultLabel={`${items.length} option(s)`}
      resultTone={items.length > 0 ? 'info' : 'warning'}
      title="Payout service evidence"
    >
      <div className="participant-list admin-mb-12">
        <a className="text-link" href="/services">
          Review service pricing
        </a>
      </div>
      <div className="service-trace-summary">
        <div>
          <span>Service options</span>
          <strong>{items.length}</strong>
        </div>
        <div>
          <span>Batches</span>
          <strong>{batchCount}</strong>
        </div>
        <div>
          <span>Gross</span>
          <strong>{formatMoney(sumEvidence(items, 'grossAmount'), currency)}</strong>
        </div>
        <div>
          <span>Partner net</span>
          <strong>{formatMoney(sumEvidence(items, 'netAmount'), currency)}</strong>
        </div>
        <div>
          <span>Platform fee</span>
          <strong>{formatMoney(sumEvidence(items, 'platformFee'), currency)}</strong>
        </div>
        <div>
          <span>Tax withheld</span>
          <strong>{formatMoney(sumEvidence(items, 'withholdingAmount'), currency)}</strong>
        </div>
      </div>
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table"
          emptyMessage="No payout batch has linked service evidence yet."
          headers={[
            'Service option',
            'Batches',
            'Earnings',
            'Gross',
            'Partner net',
            'Platform fee',
            'Tax',
            'Cash debt',
          ]}
          rowCount={items.length}
        >
          {items.map((item) => (
            <tr key={item.key}>
              <td>
                <strong>{item.label}</strong>
                <p className="muted">{item.groupKey}</p>
              </td>
              <td>{item.batchCount}</td>
              <td>{item.earningCount}</td>
              <td>{formatMoney(item.grossAmount, item.currency)}</td>
              <td>{formatMoney(item.netAmount, item.currency)}</td>
              <td>{formatMoney(item.platformFee, item.currency)}</td>
              <td>{formatMoney(item.withholdingAmount, item.currency)}</td>
              <td>
                <StatusBadge tone={item.cashDebtAmount ? 'danger' : 'success'}>
                  {formatMoney(item.cashDebtAmount, item.currency)}
                </StatusBadge>
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </AdminFilterPanel>
  );
}

function sumEvidence(
  items: readonly PayoutServiceEvidenceItem[],
  field: 'grossAmount' | 'netAmount' | 'platformFee' | 'withholdingAmount',
) {
  return items.reduce((sum, item) => sum + item[field], 0);
}
